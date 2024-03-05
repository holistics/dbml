import { partition, last } from 'lodash';
import {
  Column, Check, ElementInterpreter, Index, InlineRef,
  InterpreterDatabase, Table, TablePartialInjection,
} from '../types';
import {
  AttributeNode, BlockExpressionNode, CallExpressionNode, ElementDeclarationNode,
  FunctionApplicationNode, FunctionExpressionNode, ListExpressionNode, PrefixExpressionNode,
  SyntaxNode,
} from '../../parser/nodes';
import {
  extractColor, extractElementName, getColumnSymbolsOfRefOperand, getMultiplicities,
  getRefId, getTokenPosition, isSameEndpoint, normalizeNoteContent, processColumnType, processDefaultValue,
} from '../utils';
import {
  destructureComplexVariable, destructureIndexNode, extractQuotedStringToken, extractVarNameFromPrimaryVariable,
  extractVariableFromExpression,
} from '../../analyzer/utils';
import { CompileError, CompileErrorCode } from '../../errors';
import {
  aggregateSettingList, isValidPartialInjection,
} from '../../analyzer/validator/utils';
import { ColumnSymbol } from '../../analyzer/symbol/symbols';
import { destructureIndex, SymbolKind } from '../../analyzer/symbol/symbolIndex';
import { ElementKind, SettingName } from '../../analyzer/types';

export class TableInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private table: Partial<Table>;
  private pkColumns: Column[];

  constructor (declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.table = {
      name: undefined,
      schemaName: undefined,
      alias: null,
      fields: [],
      token: undefined,
      indexes: [],
      partials: [],
      checks: [],
    };
    this.pkColumns = [];
  }

  interpret (): CompileError[] {
    this.table.token = getTokenPosition(this.declarationNode);
    this.env.tables.set(this.declarationNode, this.table as Table);

    const errors = [
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretAlias(this.declarationNode.alias),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

    // Handle cases where there are multiple primary columns
    // all the pk field of the columns are reset to false
    // and a new pk composite index is added
    if (this.pkColumns.length >= 2) {
      this.table.indexes!.push({
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
    const { name, schemaName } = extractElementName(nameNode);

    if (schemaName.length > 1) {
      this.table.name = name;
      this.table.schemaName = schemaName.join('.');

      return [new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', nameNode)];
    }

    this.table.name = name;
    this.table.schemaName = schemaName.length ? schemaName[0] : null;

    return [];
  }

  private interpretAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (!aliasNode) {
      return [];
    }

    const alias = extractVarNameFromPrimaryVariable(aliasNode as any).unwrap_or(null);
    if (alias) {
      this.env.aliases.push({
        name: alias,
        kind: 'table',
        value: {
          tableName: this.table.name!,
          schemaName: this.table.schemaName!,
        },
      });
      this.table.alias = alias;
    }

    return [];
  }

  private interpretSettingList (settings?: ListExpressionNode): CompileError[] {
    const settingMap = aggregateSettingList(settings).getValue();

    this.table.headerColor = settingMap[SettingName.HeaderColor]?.length
      ? extractColor(settingMap[SettingName.HeaderColor]?.at(0)?.value as any)
      : undefined;

    const [noteNode] = settingMap[SettingName.Note] || [];
    this.table.note = noteNode && {
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
          this.table.note = {
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

  private interpretInjection (injection: PrefixExpressionNode, order: number) {
    const partial: Partial<TablePartialInjection> = { order, token: getTokenPosition(injection) };
    partial.name = extractVariableFromExpression(injection.expression).unwrap_or('');
    this.table.partials!.push(partial as TablePartialInjection);
    return [];
  }

  private interpretFields (fields: FunctionApplicationNode[]): CompileError[] {
    const symbolTableEntries = this.declarationNode.symbol?.symbolTable
      ? [...this.declarationNode.symbol.symbolTable.entries()]
      : [];
    const columnEntries = symbolTableEntries.filter(([index]) => {
      const res = destructureIndex(index).unwrap_or(null);
      return res?.kind === SymbolKind.Column;
    });

    const columnCountErrors = columnEntries.length
      ? []
      : [new CompileError(CompileErrorCode.EMPTY_TABLE, 'A Table must have at least one column', this.declarationNode)];

    const interpretFieldErrors = fields.flatMap((field, order) => {
      return isValidPartialInjection(field.callee)
        ? this.interpretInjection(field.callee, order)
        : this.interpretColumn(field);
    });

    return [
      ...columnCountErrors,
      ...interpretFieldErrors,
    ];
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
      // eslint-disable-next-line no-nested-ternary
      column.not_null = settingMap[SettingName.NotNull]?.length
        ? true
        : settingMap[SettingName.Null]?.length
          ? false
          : undefined;
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
        if (fragments.length === 1) {
          const [columnName] = fragments;

          inlineRef = {
            schemaName: this.table.schemaName!,
            tableName: this.table.name!,
            fieldNames: [columnName],
            relation: op.value as any,
            token: getTokenPosition(ref),
          };
        } else if (fragments.length === 2) {
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
          errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', ref));
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

        const errs = this.registerInlineRefToEnv(field, referredSymbol, inlineRef, ref);
        errors.push(...errs);

        return errs.length === 0 ? inlineRef : [];
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

    this.table.fields!.push(column as Column);
    if (column.pk) {
      this.pkColumns.push(column as Column);
    }

    return errors;
  }

  private interpretIndexes (indexes: ElementDeclarationNode): CompileError[] {
    this.table.indexes!.push(...(indexes.body as BlockExpressionNode).body.map((_indexField) => {
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
        if (!(arg instanceof CallExpressionNode)) {
          return arg;
        }
        const fragments: SyntaxNode[] = [];
        while (arg instanceof CallExpressionNode) {
          fragments.push(arg.argumentList!);
          // eslint-disable-next-line no-param-reassign
          arg = arg.callee!;
        }
        fragments.push(arg);

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
    this.table.checks!.push(...(checks.body as BlockExpressionNode).body.map((_checkField) => {
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

  private registerInlineRefToEnv (column: FunctionApplicationNode, referredSymbol: ColumnSymbol, inlineRef: InlineRef, ref: AttributeNode): CompileError[] {
    const refId = getRefId(column.symbol as ColumnSymbol, referredSymbol);
    if (this.env.refIds[refId]) {
      return [
        new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', ref),
        new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', this.env.refIds[refId]),
      ];
    }

    const multiplicities = getMultiplicities(inlineRef.relation);
    this.env.refIds[refId] = ref;
    this.env.ref.set(ref, {
      name: null,
      schemaName: null,
      token: inlineRef.token,
      endpoints: [
        {
          ...inlineRef,
          relation: multiplicities[1],
        },
        {
          schemaName: this.table.schemaName!,
          tableName: this.table.name!,
          fieldNames: [extractVariableFromExpression(column.callee!).unwrap()],
          token: getTokenPosition(column),
          relation: multiplicities[0],
        },
      ],
    });

    return [];
  }
}
