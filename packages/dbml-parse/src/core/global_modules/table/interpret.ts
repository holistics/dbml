import { partition, last } from 'lodash-es';
import type {
  Column, Check, Index, InlineRef,
  Table, TablePartialInjection, TokenPosition, SchemaElement,
} from '@/core/types/schemaJson';
import {
  BlockExpressionNode, CallExpressionNode, ElementDeclarationNode,
  FunctionApplicationNode, FunctionExpressionNode, ListExpressionNode, PrefixExpressionNode,
} from '@/core/parser/nodes';
import type { SyntaxNode } from '@/core/parser/nodes';
import {
  extractColor, extractElementName,
  getTokenPosition, normalizeNoteContent,
} from '../utils';
import {
  destructureComplexVariable, destructureIndexNode, extractQuotedStringToken, extractVarNameFromPrimaryVariable,
  extractVariableFromExpression,
  isExpressionAQuotedString, isExpressionAVariableNode,
  isExpressionASignedNumberExpression, parseNumber,
} from '@/core/utils/expression';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { aggregateSettingList, isValidPartialInjection } from '@/core/utils/validate';
import { ElementKind, SettingName } from '@/core/types/keywords';
import Compiler from '@/compiler/index';
import { UNHANDLED } from '@/constants';
import { SymbolKind } from '@/core/types/symbols';
import Report from '@/core/report';
import { interpretColumnType, interpretInlineRefs } from './utils';

export class TableInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private table: Partial<Table>;
  private pkColumns: Column[];
  private nestedRecords: any[];

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
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
    this.nestedRecords = [];
  }

  interpret (): Report<Table | SchemaElement[]> {
    this.table.token = getTokenPosition(this.declarationNode);

    const settingErrors = this.interpretSettingList(this.declarationNode.attributeList);
    const settingsNote = this.table.note;

    const errors = [
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretAlias(this.declarationNode.alias),
      ...settingErrors,
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

    // Settings note takes priority over body Note elements
    if (settingsNote) {
      this.table.note = settingsNote;
    }

    // Fill in empty tableNames in inline refs with the current table name
    for (const field of this.table.fields!) {
      for (const ref of field.inline_refs) {
        if (!ref.tableName && ref.fieldNames.length > 0) {
          ref.tableName = this.table.name!;
          ref.schemaName = this.table.schemaName!;
        }
      }
    }

    if (this.nestedRecords.length > 0) {
      return new Report([this.table as Table, ...this.nestedRecords] as SchemaElement[], errors);
    }
    return new Report(this.table as Table, errors);
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

    const alias = extractVarNameFromPrimaryVariable(aliasNode as any);
    if (alias) {
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
      value: normalizeNoteContent(extractQuotedStringToken(noteNode?.value)!),
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
            value: normalizeNoteContent(
              sub.body instanceof BlockExpressionNode
                ? extractQuotedStringToken((sub.body.body[0] as FunctionApplicationNode).callee)!
                : extractQuotedStringToken(sub.body!.callee)!,
            ),
            token: getTokenPosition(sub),
          };
          return [];

        case ElementKind.Indexes:
          return this.interpretIndexes(sub);

        case ElementKind.Checks:
          return this.interpretChecks(sub);

        case ElementKind.Records: {
          // Nested records are collected and returned alongside the table
          const result = this.compiler.interpret(sub);
          if (!result.hasValue(UNHANDLED)) {
            this.nestedRecords.push(result.getValue());
          }
          return [];
        }

        default:
          return [];
      }
    });
  }

  private interpretInjection (injection: PrefixExpressionNode, order: number) {
    const partial: Partial<TablePartialInjection> = { order, token: getTokenPosition(injection) };
    partial.name = extractVariableFromExpression(injection.expression) ?? '';
    this.table.partials!.push(partial as TablePartialInjection);
    return [];
  }

  private interpretFields (fields: FunctionApplicationNode[]): CompileError[] {
    // Check for empty table via compiler symbol resolution
    const symbolResult = this.compiler.nodeSymbol(this.declarationNode);
    let hasColumns = true;
    if (!symbolResult.hasValue(UNHANDLED)) {
      const membersResult = this.compiler.symbolMembers(symbolResult.getValue());
      const members = !membersResult.hasValue(UNHANDLED) ? membersResult.getValue() : [];
      // Filter to actual column members (excluding partial injections)
      const columnMembers = members.filter((m: any) => {
        if (!m.declaration) return false;
        const parent = m.declaration.parent;
        if (parent instanceof ElementDeclarationNode && parent !== this.declarationNode) return false;
        if (m.declaration instanceof FunctionApplicationNode && isValidPartialInjection(m.declaration.callee)) return false;
        return true;
      });
      hasColumns = columnMembers.length > 0;
    }

    const columnCountErrors = hasColumns
      ? []
      : [new CompileError(CompileErrorCode.EMPTY_TABLE, 'A Table must have at least one column', this.declarationNode)];

    const interpretFieldErrors = fields.flatMap((field, order) => {
      return isValidPartialInjection(field.callee)
        ? this.interpretInjection(field.callee as PrefixExpressionNode, order)
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

    column.name = extractVarNameFromPrimaryVariable(field.callee as any) ?? '';

    column.type = interpretColumnType(field.args[0]);

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
        : settingMap[SettingName.Null]?.length
          ? false
          : undefined;

      const defaultNode = settingMap[SettingName.Default]?.at(0)?.value;
      if (defaultNode) {
        if (isExpressionAQuotedString(defaultNode)) {
          column.dbdefault = { value: extractQuotedStringToken(defaultNode) ?? '', type: 'string' };
        } else if (isExpressionASignedNumberExpression(defaultNode)) {
          column.dbdefault = { type: 'number', value: parseNumber(defaultNode) };
        } else if (defaultNode instanceof FunctionExpressionNode) {
          column.dbdefault = { value: defaultNode.value?.value ?? '', type: 'expression' };
        } else if (isExpressionAVariableNode(defaultNode)) {
          const val = defaultNode.expression.variable.value.toLowerCase();
          column.dbdefault = { value: val, type: 'boolean' };
        } else {
          // Enum default value: schema.enum.field or enum.field
          const fragments = destructureComplexVariable(defaultNode);
          if (fragments && fragments.length > 0) {
            column.dbdefault = { value: fragments.at(-1) ?? '', type: 'string' };
          }
        }
      }

      const noteNode = settingMap[SettingName.Note]?.at(0);
      column.note = noteNode && {
        value: normalizeNoteContent(extractQuotedStringToken(noteNode.value)!),
        token: getTokenPosition(noteNode),
      };

      const refs = settingMap[SettingName.Ref] || [];
      column.inline_refs = interpretInlineRefs(refs);

      const checkNodes = settingMap[SettingName.Check] || [];
      column.checks = checkNodes.map((checkNode) => {
        const token = getTokenPosition(checkNode);
        const expression = (checkNode.value as FunctionExpressionNode).value!.value!;
        return { token, expression } as Check;
      });
    }

    column.pk ||= settings.some((setting) => (extractVariableFromExpression(setting) ?? '').toLowerCase() === 'pk');
    column.unique ||= settings.some((setting) => (extractVariableFromExpression(setting) ?? '').toLowerCase() === 'unique');

    this.table.fields!.push(column as Column);
    if (column.pk) {
      this.pkColumns.push(column as Column);
    }

    return errors;
  }

  private isEnumType (typeNode: SyntaxNode): boolean {
    // Check if the type resolves to an Enum symbol via nodeReferee.
    // nodeReferee on the type node inside a table field will use nodeRefereeOfEnumType.
    const result = this.compiler.nodeReferee(typeNode);
    if (result.hasValue(UNHANDLED)) return false;
    const sym = result.getValue();
    if (!sym) return false;
    return sym.isKind(SymbolKind.Enum);
  }

  private interpretIndexes (indexes: ElementDeclarationNode): CompileError[] {
    this.table.indexes?.push(...(indexes.body as BlockExpressionNode).body.map((_indexField) => {
      const index: Partial<Index> = { columns: [] };

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
        if (!(arg instanceof CallExpressionNode)) {
          return arg;
        }
        const fragments: SyntaxNode[] = [];
        while (arg instanceof CallExpressionNode) {
          fragments.push(arg.argumentList!);

          arg = arg.callee!;
        }
        fragments.push(arg);

        return fragments;
      }).forEach((arg) => {
        const { functional, nonFunctional } = destructureIndexNode(arg)!;
        index.columns!.push(
          ...functional.map((s) => ({
            value: s.value!.value,
            type: 'expression',
            token: getTokenPosition(s),
          })),
          ...nonFunctional.map((s) => ({
            value: extractVarNameFromPrimaryVariable(s as any) ?? '',
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
        check.name = extractQuotedStringToken(settingMap[SettingName.Name]?.at(0)?.value);
      }

      check.expression = (checkField.callee as FunctionExpressionNode).value!.value!;

      return check as Check;
    }));

    return [];
  }
}
