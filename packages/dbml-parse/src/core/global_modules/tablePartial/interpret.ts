import {
  head, last, partition,
} from 'lodash-es';
import Compiler from '@/compiler/index';
import {
  CompileError,
} from '@/core/types/errors';
import {
  ElementKind, SettingName,
} from '@/core/types/keywords';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Check, Column, Index, InlineRef, Ref,
  SchemaElement, TablePartial,
} from '@/core/types/schemaJson';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  ColumnSymbol, TablePartialSymbol,
} from '@/core/types/symbol/symbols';
import {
  extractQuotedStringToken, extractVarNameFromPrimaryVariable,
} from '@/core/utils/expression';
import {
  aggregateSettingList,
} from '@/core/utils/validate';
import {
  extractColor, extractElementName, getTokenPosition,
  normalizeNote, processColumnType,
} from '@/core/utils/interpret';
import {
  UNHANDLED,
} from '@/core/types/module';
import type {
  PartialRefMetadata,
} from '@/core/types/symbol/metadata';

export class TablePartialInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private symbol?: TablePartialSymbol;
  private filepath: Filepath;
  private tablePartial: Partial<TablePartial>;
  private pkColumns: Column[];

  constructor (compiler: Compiler, symbol: TablePartialSymbol, filepath: Filepath) {
    this.compiler = compiler;
    this.declarationNode = symbol.declaration as ElementDeclarationNode;
    this.symbol = symbol;
    this.filepath = filepath;
    this.tablePartial = {
      name: undefined,
      fields: [],
      token: undefined,
      indexes: [],
      checks: [],
    };
    this.pkColumns = [];
  }

  interpret (): Report<SchemaElement | SchemaElement[] | undefined> {
    this.tablePartial.token = this.symbol?.token ?? getTokenPosition(this.declarationNode);

    if (this.symbol) {
      this.tablePartial.name = this.symbol.interpretedName(this.compiler, this.filepath).name;
    } else {
      this.interpretName(this.declarationNode.name!);
    }

    const errors = [
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

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

    return new Report(this.tablePartial as TablePartial, errors);
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

    const [
      noteNode,
    ] = settingMap[SettingName.Note] || [];
    this.tablePartial.note = noteNode && {
      value: extractQuotedStringToken(noteNode?.value) ? normalizeNote(extractQuotedStringToken(noteNode?.value)!) : '',
      token: getTokenPosition(noteNode),
    };

    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    const [
      fields,
      subs,
    ] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
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
            value: normalizeNote(
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
    const columnSymbol = this.compiler.nodeSymbol(field).getFiltered(UNHANDLED) as ColumnSymbol | undefined;

    column.name = extractVarNameFromPrimaryVariable(field.callee as any) ?? '';
    column.token = getTokenPosition(field);

    const typeReport = processColumnType(this.compiler, field.args[0]);
    column.type = typeReport.getValue();
    errors.push(...typeReport.getErrors());

    column.pk = columnSymbol?.pk(this.compiler) ?? false;
    column.unique = columnSymbol?.unique(this.compiler) ?? false;
    column.increment = columnSymbol?.increment(this.compiler) ?? false;
    const nullable = columnSymbol?.nullable(this.compiler);
    column.not_null = nullable === undefined ? undefined : !nullable;
    column.dbdefault = columnSymbol?.default(this.compiler);
    column.note = columnSymbol?.note(this.compiler);

    const settingMap = this.compiler.nodeSettings(field).getFiltered(UNHANDLED) ?? {};

    const programNode = this.compiler.parseFile(this.filepath).getValue().ast;
    const programSymbol = this.compiler.nodeSymbol(programNode).getFiltered(UNHANDLED);

    const refs = settingMap[SettingName.Ref] || [];
    column.inline_refs = refs.flatMap((ref) => {
      const meta = this.compiler.nodeMetadata(ref).getFiltered(UNHANDLED);
      if (!meta) return [];

      const owners = meta.owners(this.compiler);
      if (programSymbol && owners.length > 0 && !owners.some((o) => o === programSymbol)) return [];

      const result = this.compiler.interpretMetadata(meta, this.filepath);
      if (result.hasValue(UNHANDLED)) return [];

      errors.push(...result.getErrors());
      const value = result.getValue() as Ref | undefined;

      if (!value?.endpoints?.[1]) return [];
      const ep = value.endpoints[1];
      const op = (meta as PartialRefMetadata).op(this.compiler);
      if (!op) return [];

      const inlineRef: InlineRef = {
        schemaName: ep.schemaName,
        tableName: ep.tableName,
        fieldNames: ep.fieldNames,
        relation: op,
        token: ep.token,
      };
      return inlineRef;
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

    this.tablePartial.fields?.push(column as Column);
    if (column.pk) {
      this.pkColumns.push(column as Column);
    }
    return errors;
  }

  private interpretIndexes (indexes: ElementDeclarationNode): CompileError[] {
    const meta = this.compiler.nodeMetadata(indexes).getFiltered(UNHANDLED);
    if (!meta) return [];

    const result = this.compiler.interpretMetadata(meta, this.filepath);
    if (result.hasValue(UNHANDLED)) return [];

    const index = result.getValue();
    if (Array.isArray(index)) this.tablePartial.indexes?.push(...index as Index[]);
    else if (index) this.tablePartial.indexes?.push(index as Index);
    return result.getErrors();
  }

  private interpretChecks (checks: ElementDeclarationNode): CompileError[] {
    const meta = this.compiler.nodeMetadata(checks).getFiltered(UNHANDLED);
    if (!meta) return [];

    const result = this.compiler.interpretMetadata(meta, this.filepath);
    if (result.hasValue(UNHANDLED)) return [];

    const check = result.getValue();
    if (Array.isArray(check)) this.tablePartial.checks?.push(...check as Check[]);
    else if (check) this.tablePartial.checks?.push(check as Check);
    return result.getErrors();
  }
}
