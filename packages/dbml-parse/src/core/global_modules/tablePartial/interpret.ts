import {
  head, last, partition,
} from 'lodash-es';
import Compiler from '@/compiler/index';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementKind, SettingName,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, UNHANDLED,
} from '@/core/types/module';
import {
  ArrayNode, BlockExpressionNode, CallExpressionNode, ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode, ListExpressionNode, PrefixExpressionNode, SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Check, Column, ColumnType, Index, InlineRef,
  SchemaElement, TablePartial, TokenPosition,
} from '@/core/types/schemaJson';
import {
  SymbolKind,
} from '@/core/types/symbol';
import {
  getNumberTextFromExpression, isElementFieldNode,
  isElementNode, isExpressionAQuotedString,
  isExpressionASignedNumberExpression, isExpressionAVariableNode,
  isRelationshipOp, parseNumber,
} from '@/core/utils/expression';
import {
  destructureComplexVariable, destructureIndexNode, extractQuotedStringToken, extractVarNameFromPrimaryVariable,
  extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  aggregateSettingList,
} from '@/core/utils/validate';
import {
  extractColor, extractElementName, getTokenPosition,
  normalizeNoteContent,
} from '../utils';

export class TablePartialInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private node: SyntaxNode;
  private tablePartial: Partial<TablePartial>;
  private pkColumns: Column[];

  constructor (compiler: Compiler, node: SyntaxNode) {
    this.compiler = compiler;
    this.node = node;
    this.declarationNode = node as ElementDeclarationNode;
    this.tablePartial = {
      name: undefined,
      fields: [],
      token: undefined,
      indexes: [],
      checks: [],
    };
    this.pkColumns = [];
  }

  interpret (): Report<SchemaElement | SchemaElement[] | undefined> | Report<typeof PASS_THROUGH> {
    if (isElementNode(this.node, ElementKind.TablePartial)) {
      return this.interpretElement();
    }
    if (isElementFieldNode(this.node, ElementKind.TablePartial)) {
      const field = this.node as FunctionApplicationNode;
      const errors = this.interpretColumn(field);
      const column = this.tablePartial.fields!.pop();
      if (this.pkColumns.length > 0) this.pkColumns.pop();
      return new Report<Column | undefined>(column, errors);
    }
    return Report.create(PASS_THROUGH);
  }

  private interpretElement (): Report<TablePartial | undefined> {
    this.declarationNode = this.node as ElementDeclarationNode;
    this.tablePartial.token = getTokenPosition(this.declarationNode);

    const errors = [...this.interpretName(this.declarationNode.name!), ...this.interpretSettingList(this.declarationNode.attributeList), ...this.interpretBody(this.declarationNode.body as BlockExpressionNode)];

    // Handle cases where there are multiple primary columns
    // all the pk field of the columns are reset to false
    // and a new pk composite index is added
    if (this.pkColumns.length >= 2) {
      this.tablePartial.indexes!.push({
        columns: this.pkColumns.map(({
          name, token,
        }) => ({
          value: name,
          type: 'column',
          token,
        })),
        pk: true,
        token: {
          start: {
            offset: -1,
            line: -1,
            column: -1,
          }, // do not make sense to have a meaningful start (?)
          end: {
            offset: -1,
            line: -1,
            column: -1,
          }, // do not make sense to have a meaningful end (?)
          filepath: this.declarationNode.filepath,
        },
      });
      this.pkColumns.forEach((column) => {
        column.pk = false;
      });
    }

    return new Report<TablePartial | undefined>({
      name: this.tablePartial.name!,
      fields: this.tablePartial.fields!,
      token: this.tablePartial.token!,
      indexes: this.tablePartial.indexes!,
      checks: this.tablePartial.checks!,
      ...(this.tablePartial.headerColor && {
        headerColor: this.tablePartial.headerColor,
      }),
      ...(this.tablePartial.note && {
        note: this.tablePartial.note,
      }),
    }, errors);
  }

  private interpretName (nameNode: SyntaxNode): CompileError[] {
    const {
      name,
    } = extractElementName(nameNode);

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
      value: extractQuotedStringToken(noteNode?.value) ? normalizeNoteContent(extractQuotedStringToken(noteNode?.value)!) : '',
      token: getTokenPosition(noteNode),
    };

    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.interpretFields(fields as FunctionApplicationNode[]), ...this.interpretSubElements(subs as ElementDeclarationNode[])];
  }

  private interpretSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      switch (sub.type?.value.toLowerCase()) {
        case ElementKind.Note:
          this.tablePartial.note = {
            value: normalizeNoteContent(
              extractQuotedStringToken(
                sub.body instanceof BlockExpressionNode
                  ? (sub.body.body[0] as FunctionApplicationNode).callee
                  : sub.body!.callee,
              )!,
            ),
            token: getTokenPosition(sub),
          };
          return [];

        case ElementKind.Indexes:
          return this.interpretIndexes(sub);

        case ElementKind.Checks:
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

    column.name = extractVarNameFromPrimaryVariable(field.callee as any) ?? '';

    const columnType = this.interpretColumnType(field);
    column.type = columnType;

    // Check if type resolves to an enum
    if (field.args[0]) {
      column.type.isEnum = this.isEnumType(field.args[0]);
    }

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

      const defaultSetting = settingMap[SettingName.Default]?.at(0)?.value;
      if (defaultSetting) {
        if (isExpressionAQuotedString(defaultSetting)) {
          column.dbdefault = {
            value: extractQuotedStringToken(defaultSetting) ?? '',
            type: 'string',
          };
        } else if (isExpressionASignedNumberExpression(defaultSetting)) {
          column.dbdefault = {
            type: 'number',
            value: parseNumber(defaultSetting),
          };
        } else if (defaultSetting instanceof FunctionExpressionNode) {
          column.dbdefault = {
            value: defaultSetting.value?.value ?? '',
            type: 'expression',
          };
        } else if (isExpressionAVariableNode(defaultSetting)) {
          const val = defaultSetting.expression.variable.value.toLowerCase();
          column.dbdefault = {
            value: val,
            type: 'boolean',
          };
        } else {
          const fragments = destructureComplexVariable(defaultSetting);
          if (fragments && fragments.length > 0) {
            column.dbdefault = {
              value: fragments.at(-1) ?? '',
              type: 'string',
            };
          }
        }
      }

      const noteNode = settingMap[SettingName.Note]?.at(0);
      column.note = noteNode && {
        value: extractQuotedStringToken(noteNode.value) ? normalizeNoteContent(extractQuotedStringToken(noteNode.value)!) : '',
        token: getTokenPosition(noteNode),
      };

      const refs = settingMap[SettingName.Ref] || [];
      column.inline_refs = refs.flatMap((ref) => {
        const op = (ref.value as PrefixExpressionNode).op!;
        const fragments = destructureComplexVariable((ref.value as PrefixExpressionNode).expression) ?? [];

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

        return inlineRef ? [inlineRef] : [];
      });

      const checkNodes = settingMap[SettingName.Check] || [];
      column.checks = checkNodes.map((checkNode) => {
        const token = getTokenPosition(checkNode);
        const expression = (checkNode.value as FunctionExpressionNode).value!.value!;
        return {
          token,
          expression,
        } as Check;
      });
    }

    column.pk ||= settings.some((setting) => (extractVariableFromExpression(setting) ?? '').toLowerCase() === 'pk');
    column.unique ||= settings.some((setting) => (extractVariableFromExpression(setting) ?? '').toLowerCase() === 'unique');

    this.tablePartial.fields!.push(column as Column);
    if (column.pk) {
      this.pkColumns.push(column as Column);
    }
    return errors;
  }

  private isEnumType (typeNode: SyntaxNode): boolean {
    const result = this.compiler.nodeReferee(typeNode);
    if (result.hasValue(UNHANDLED)) return false;
    const sym = result.getValue();
    if (!sym) return false;
    return sym.isKind(SymbolKind.Enum);
  }

  private interpretColumnType (field: FunctionApplicationNode): ColumnType {
    let rawTypeNode: SyntaxNode | undefined = field.args[0];
    let columnType: ColumnType = {
      schemaName: null,
      type_name: '',
      args: null,
    };

    if (!rawTypeNode) return columnType;

    let typeSuffix = '';
    let typeArgs: string | null = null;

    if (rawTypeNode instanceof CallExpressionNode && rawTypeNode.argumentList) {
      typeArgs = rawTypeNode.argumentList.elementList.map((e) => {
        if (isExpressionASignedNumberExpression(e)) return getNumberTextFromExpression(e);
        if (isExpressionAQuotedString(e)) return extractQuotedStringToken(e) ?? '';
        if (isExpressionAVariableNode(e)) return e.expression.variable.value;
        return '';
      }).join(',');
      typeSuffix = `(${typeArgs})`;
      rawTypeNode = rawTypeNode.callee;
    }

    while (rawTypeNode instanceof CallExpressionNode || rawTypeNode instanceof ArrayNode) {
      if (rawTypeNode instanceof CallExpressionNode) {
        const args = rawTypeNode.argumentList?.elementList.map((e) => {
          if (isExpressionASignedNumberExpression(e)) return getNumberTextFromExpression(e);
          if (isExpressionAQuotedString(e)) return extractQuotedStringToken(e) ?? '';
          if (isExpressionAVariableNode(e)) return e.expression.variable.value;
          return '';
        }).join(',') ?? '';
        typeSuffix = `(${args})${typeSuffix}`;
        rawTypeNode = rawTypeNode.callee;
      } else {
        const indexer = `[${rawTypeNode.indexer?.elementList.map((e: any) => e?.name?.expression?.literal?.value ?? '').join(',') ?? ''}]`;
        typeSuffix = `${indexer}${typeSuffix}`;
        rawTypeNode = rawTypeNode.array;
      }
    }

    const typeFragments = rawTypeNode ? destructureComplexVariable(rawTypeNode) : undefined;
    if (typeFragments && typeFragments.length > 0) {
      const typeName = typeFragments.at(-1) ?? '';
      const typeSchema = typeFragments.length > 1 ? typeFragments.slice(0, -1).join('.') : null;
      columnType = {
        schemaName: typeSchema,
        type_name: `${typeName}${typeSuffix}`,
        args: typeArgs,
      };
    }

    return columnType;
  }

  private interpretIndexes (indexes: ElementDeclarationNode): CompileError[] {
    this.tablePartial.indexes!.push(...(indexes.body as BlockExpressionNode).body.map((_indexField) => {
      const index: Partial<Index> = {
        columns: [],
      };

      const indexField = _indexField as FunctionApplicationNode;
      index.token = getTokenPosition(indexField);
      const args = [indexField.callee!, ...indexField.args];
      if (last(args) instanceof ListExpressionNode) {
        const settingMap = aggregateSettingList(args.pop() as ListExpressionNode).getValue();
        index.pk = !!settingMap[SettingName.PK]?.length;
        index.unique = !!settingMap[SettingName.Unique]?.length;
        index.name = extractQuotedStringToken(settingMap[SettingName.Name]?.at(0)?.value);
        const noteNode = settingMap[SettingName.Note]?.at(0);
        index.note = noteNode && {
          value: extractQuotedStringToken(noteNode.value)!,
          token: getTokenPosition(noteNode),
        };
        index.type = extractVariableFromExpression(settingMap[SettingName.Type]?.at(0)?.value);
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
        const {
          functional, nonFunctional,
        } = destructureIndexNode(arg)!;
        index.columns!.push(
          ...functional.map((s) => ({
            value: s.value!.value,
            type: 'expression',
            token: getTokenPosition(s),
          })),
          ...nonFunctional.map((s) => ({
            value: extractVarNameFromPrimaryVariable(s) ?? '',
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
        check.name = extractQuotedStringToken(settingMap[SettingName.Name]?.at(0)?.value);
      }

      check.expression = (checkField.callee as FunctionExpressionNode).value!.value!;

      return check as Check;
    }));

    return [];
  }
}
