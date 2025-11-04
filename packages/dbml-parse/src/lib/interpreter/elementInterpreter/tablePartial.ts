import { last, head, partition } from 'lodash';
import {
  Column, Check, ElementInterpreter, Index, InlineRef,
  InterpreterDatabase, TablePartial,
} from '../types';
import {
  BlockExpressionNode, CallExpressionNode, ElementDeclarationNode, FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode, PrefixExpressionNode, SyntaxNode,
} from '../../parser/nodes';
import {
  extractColor, extractElementName, getColumnSymbolsOfRefOperand, getTokenPosition,
  isSameEndpoint, normalizeNoteContent, processColumnType, processDefaultValue,
} from '../utils';
import {
  destructureComplexVariable, destructureIndexNode, extractQuotedStringToken, extractVarNameFromPrimaryVariable,
  extractVariableFromExpression,
} from '../../analyzer/utils';
import { CompileError, CompileErrorCode } from '../../errors';
import { aggregateSettingList } from '../../analyzer/validator/utils';
import { ColumnSymbol } from '../../analyzer/symbol/symbols';
import { ElementKind, SettingName } from '../../analyzer/types';

export class TablePartialInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private tablePartial: Partial<TablePartial>;
  private pkColumns: Column[];

  constructor (declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.tablePartial = {
      name: undefined, fields: [], token: undefined, indexes: [], checks: [],
    };
    this.pkColumns = [];
  }

  interpret (): CompileError[] {
    this.tablePartial.token = getTokenPosition(this.declarationNode);
    this.env.tablePartials.set(this.declarationNode, this.tablePartial as TablePartial);

    const errors = [
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

    // Handle cases where there are multiple primary columns
    // all the pk field of the columns are reset to false
    // and a new pk composite index is added
    if (this.pkColumns.length >= 2) {
      this.tablePartial.indexes!.push({
        columns: this.pkColumns.map(({ name, token }) => ({ value: name, type: 'column', token })),
        token: {
          start: { offset: -1, line: -1, column: -1 }, // do not make sense to have a meaningful start (?)
          end: { offset: -1, line: -1, column: -1 }, // do not make sense to have a meaningful end (?)
        },
        pk: true,
      });
      this.pkColumns.forEach((column) => { column.pk = false; });
    }

    return errors;
  }

  private interpretName (nameNode: SyntaxNode): CompileError[] {
    const { name } = extractElementName(nameNode);

    this.tablePartial.name = name;

    return [];
  }

  private interpretSettingList (settings?: ListExpressionNode): CompileError[] {
    const settingMap = aggregateSettingList(settings).getValue();

    const firstHeaderColor = head(settingMap[SettingName.HeaderColor]);
    this.tablePartial.headerColor = firstHeaderColor
      ? extractColor(firstHeaderColor.value as any)
      : undefined;

    const [noteNode] = settingMap[SettingName.Note] || [];
    this.tablePartial.note = noteNode && {
      value: extractQuotedStringToken(noteNode?.value).map(normalizeNoteContent).unwrap(),
      token: getTokenPosition(noteNode),
    };

    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.interpretFields(fields as FunctionApplicationNode[]),
      ...this.interpretSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private interpretSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      switch (sub.type?.value.toLowerCase()) {
        case ElementKind.Note:
          this.tablePartial.note = {
            value: extractQuotedStringToken(
              sub.body instanceof BlockExpressionNode
                ? (sub.body.body[0] as FunctionApplicationNode).callee
                : sub.body!.callee,
            ).map(normalizeNoteContent).unwrap(),
            token: getTokenPosition(sub),
          };
          return [];

        case ElementKind.Indexes:
          return this.interpretIndexes(sub);

        case ElementKind.Check:
          return this.interpretChecks(sub);

        default:
          return [];
      }
    });
  }

  private interpretFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => this.interpretColumn(field));
  }

  private interpretColumn (field: FunctionApplicationNode): CompileError[] {
    const errors: CompileError[] = [];

    const column: Partial<Column> = {};

    column.name = extractVarNameFromPrimaryVariable(field.callee as any).unwrap();

    const typeReport = processColumnType(field.args[0]);
    column.type = typeReport.getValue();
    errors.push(...typeReport.getErrors());

    column.token = getTokenPosition(field);
    column.inline_refs = [];

    const settings = field.args.slice(1);
    if (last(settings) instanceof ListExpressionNode) {
      const settingMap = aggregateSettingList(settings.pop() as ListExpressionNode).getValue();

      column.pk = !!settingMap[SettingName.PK]?.length || !!settingMap[SettingName.PrimaryKey]?.length;
      column.increment = !!settingMap[SettingName.Increment]?.length;
      column.unique = !!settingMap[SettingName.Unique]?.length;
       
      column.not_null = settingMap[SettingName.NotNull]?.length
        ? true
        : (
          settingMap[SettingName.Null]?.length
            ? false
            : undefined
        );
      column.dbdefault = processDefaultValue(settingMap[SettingName.Default]?.at(0)?.value);

      const noteNode = settingMap[SettingName.Note]?.at(0);
      column.note = noteNode && {
        value: extractQuotedStringToken(noteNode.value).map(normalizeNoteContent).unwrap(),
        token: getTokenPosition(noteNode),
      };

      const refs = settingMap[SettingName.Ref] || [];
      column.inline_refs = refs.flatMap((ref) => {
        const [referredSymbol] = getColumnSymbolsOfRefOperand((ref.value as PrefixExpressionNode).expression!);

        if (isSameEndpoint(referredSymbol, field.symbol as ColumnSymbol)) {
          errors.push(new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', ref));
          return [];
        }

        const op = (ref.value as PrefixExpressionNode).op!;
        const fragments = destructureComplexVariable((ref.value as PrefixExpressionNode).expression).unwrap();

        let inlineRef: InlineRef | undefined;
        if (fragments.length === 2) {
          const [table, columnName] = fragments;
          inlineRef = {
            schemaName: null,
            tableName: table,
            fieldNames: [columnName],
            relation: op.value as any,
            token: getTokenPosition(ref),
          };
        } else if (fragments.length === 3) {
          const [schema, table, columnName] = fragments;
          inlineRef = {
            schemaName: schema,
            tableName: table,
            fieldNames: [columnName],
            relation: op.value as any,
            token: getTokenPosition(ref),
          };
        } else {
          errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Unsupported', ref));
          const columnName = fragments.pop()!;
          const table = fragments.pop()!;
          const schema = fragments.join('.');
          inlineRef = {
            schemaName: schema,
            tableName: table,
            fieldNames: [columnName],
            relation: op.value as any,
            token: getTokenPosition(ref),
          };
        }

        return inlineRef;
      });

      const checkNodes = settingMap[SettingName.Check] || [];
      column.checks = checkNodes.map((checkNode) => {
        const token = getTokenPosition(checkNode);
        const expression = (checkNode.value as FunctionExpressionNode).value!.value!;
        return {
          token,
          expression,
        };
      });
    }

    column.pk ||= settings.some((setting) => extractVariableFromExpression(setting).unwrap().toLowerCase() === 'pk');
    column.unique ||= settings.some((setting) => extractVariableFromExpression(setting).unwrap().toLowerCase() === 'unique');

    this.tablePartial.fields!.push(column as Column);
    if (column.pk) {
      this.pkColumns.push(column as Column);
    }
    return errors;
  }

  private interpretIndexes (indexes: ElementDeclarationNode): CompileError[] {
    this.tablePartial.indexes!.push(...(indexes.body as BlockExpressionNode).body.map((_indexField) => {
      const index: Partial<Index> = { columns: [] };

      const indexField = _indexField as FunctionApplicationNode;
      index.token = getTokenPosition(indexField);
      const args = [indexField.callee!, ...indexField.args];
      if (last(args) instanceof ListExpressionNode) {
        const settingMap = aggregateSettingList(args.pop() as ListExpressionNode).getValue();
        index.pk = !!settingMap[SettingName.PK]?.length;
        index.unique = !!settingMap[SettingName.Unique]?.length;
        index.name = extractQuotedStringToken(settingMap[SettingName.Name]?.at(0)?.value).unwrap_or(undefined);
        const noteNode = settingMap[SettingName.Note]?.at(0);
        index.note = noteNode && {
          value: extractQuotedStringToken(noteNode.value).unwrap(),
          token: getTokenPosition(noteNode),
        };
        index.type = extractVariableFromExpression(settingMap[SettingName.Type]?.at(0)?.value).unwrap_or(undefined);
      }

      args.flatMap((arg) => {
        // This is to deal with indexes fields such as
        // (id, name) (age, weight)
        // which is a call expression
        if (!(arg instanceof CallExpressionNode)) return arg;

        const fragments: SyntaxNode[] = [];
        let argPtr = arg;

        while (argPtr instanceof CallExpressionNode) {
          fragments.push(argPtr.argumentList!);
          argPtr = argPtr.callee!;
        }
        fragments.push(argPtr);
        return fragments;
      }).forEach((arg) => {
        const { functional, nonFunctional } = destructureIndexNode(arg).unwrap();
        index.columns!.push(
          ...functional.map((s) => ({
            value: s.value!.value,
            type: 'expression',
            token: getTokenPosition(s),
          })),
          ...nonFunctional.map((s) => ({
            value: extractVarNameFromPrimaryVariable(s).unwrap(),
            type: 'column',
            token: getTokenPosition(s),
          })),
        );
      });

      return index as Index;
    }));

    return [];
  }

  private interpretChecks (checks: ElementDeclarationNode): CompileError[] {
    this.tablePartial.checks!.push(...(checks.body as BlockExpressionNode).body.map((_checkField) => {
      const check: Partial<Check> = {};
      const checkField = _checkField as FunctionApplicationNode;
      check.token = getTokenPosition(checkField);

      if (checkField.args[0] instanceof ListExpressionNode) {
        const settingMap = aggregateSettingList(checkField.args[0] as ListExpressionNode).getValue();
        check.name = extractQuotedStringToken(settingMap[SettingName.Name]?.at(0)?.value).unwrap_or(undefined);
      }

      check.expression = (checkField.callee as FunctionExpressionNode).value!.value!;

      return check as Check;
    }));

    return [];
  }
}
