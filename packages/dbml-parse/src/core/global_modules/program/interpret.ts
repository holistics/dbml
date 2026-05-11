import Compiler from '@/compiler/index';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import type { CompileWarning } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { ProgramNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Alias, Database, DiagramView, Enum, Note, Project, Ref, RefEndpoint, SchemaElement, Table, TableGroup, TablePartial, TableRecord,
} from '@/core/types/schemaJson';
import { AliasKind } from '@/core/types/schemaJson';
import {
  AliasSymbol,
  type NodeSymbol,
  ProgramSymbol,
  SchemaSymbol,
  SymbolKind,
} from '@/core/types/symbol';
import { MetadataKind, PartialRefMetadata, RecordsMetadata } from '@/core/types/symbol/metadata';
import { TableSymbol } from '@/core/types/symbol';
import type { InternedNodeSymbol } from '@/core/types/symbol/symbols';
import {
  InjectedColumnSymbol,
  TablePartialSymbol,
  UseSymbol,
} from '@/core/types/symbol/symbols';
import { pushExternal } from './utils';
import type { ElementRef } from '@/core/types/schemaJson';
import { validateForeignKeys, validatePrimaryKey, validateUnique } from '../records/utils/constraints';
import type { TableInfo } from '../records/utils/constraints/fk';
import { getTokenPosition } from '@/core/utils/interpret';
import { getMultiplicities } from '../utils';

export default class ProgramInterpreter {
  private compiler: Compiler;
  private programSymbol: ProgramSymbol;
  private programNode: ProgramNode;
  private filepath: Filepath;
  private errors: CompileError[] = [];
  private warnings: CompileWarning[] = [];
  private db: Database;

  constructor (compiler: Compiler, symbol: ProgramSymbol, filepath: Filepath) {
    this.compiler = compiler;
    this.programSymbol = symbol;
    this.programNode = symbol.declaration;
    this.filepath = filepath;
    this.db = {
      schemas: [],
      tables: [],
      notes: [],
      refs: [],
      enums: [],
      tableGroups: [],
      aliases: [],
      tablePartials: [],
      records: [],
      diagramViews: [],
      token: getTokenPosition(this.programNode),
      externals: {
        tables: [],
        enums: [],
        tableGroups: [],
        tablePartials: [],
        notes: [],
      },
    };
  }

  interpret (): Report<SchemaElement | SchemaElement[] | undefined> {
    this.interpretAllSymbols();
    this.interpretAllMetadata();
    this.interpretAllAliases();
    this.warnings.push(...this.validateRecords());
    return new Report(this.db, this.errors, this.warnings);
  }

  private interpretAllSymbols () {
    // 1a. Local declarations in source order
    for (const node of this.programSymbol.declaration.declarations) {
      const symbol = this.compiler.nodeSymbol(node).getFiltered(UNHANDLED);
      if (!symbol) continue;
      if (symbol instanceof UseSymbol) continue; // handled below
      const result = this.compiler.interpretSymbol(symbol, this.filepath);
      if (result.hasValue(UNHANDLED)) continue;
      this.errors.push(...result.getErrors());
      this.warnings.push(...result.getWarnings());
      const value = result.getValue();
      if (value) this.pushElement(symbol, value);
    }

    // 1b. UseSymbols (imports) from schema members.
    // The same original symbol can appear in multiple schemas (e.g. imported via
    // wildcard and also via aliased schema). Only interpret each original once.
    const interpretedOriginals = new Set<string>();
    const schemas = this.compiler.symbolMembers(this.programSymbol).getFiltered(UNHANDLED) ?? [];
    for (const schema of schemas) {
      if (!(schema instanceof SchemaSymbol)) continue;
      const members = this.compiler.symbolMembers(schema).getFiltered(UNHANDLED) ?? [];
      for (const member of members) {
        if (!(member instanceof UseSymbol)) continue;
        const originalKey = member.originalSymbol.intern();
        if (interpretedOriginals.has(originalKey)) continue;
        interpretedOriginals.add(originalKey);
        this.interpretUseSymbol(member);
      }
    }
  }

  private interpretUseSymbol (use: UseSymbol) {
    const original = use.originalSymbol;
    const result = this.compiler.interpretSymbol(original, this.filepath);
    if (!result.hasValue(UNHANDLED)) {
      this.errors.push(...result.getErrors());
      this.warnings.push(...result.getWarnings());
      const value = result.getValue();
      if (value) this.pushElement(use, value);
    }

    const sourceName = original instanceof TableSymbol
      ? original.interpretedName(this.compiler, original.filepath)
      : {
          name: original.name ?? '',
          schema: null,
        };
    const visibleName = original instanceof TableSymbol
      ? original.interpretedName(this.compiler, this.filepath)
      : {
          name: use.name ?? original.name ?? '',
          schema: null,
        };

    const ref: ElementRef = {
      name: sourceName.name,
      schemaName: sourceName.schema,
      filepath: original.filepath,
      visibleNames: [
        {
          schemaName: visibleName.schema,
          name: visibleName.name,
        },
      ],
    };
    pushExternal(this.db, use, ref);
  }

  private interpretAllMetadata () {
    const metadatas = this.compiler.symbolMetadata(this.programSymbol) ?? [];
    const seenRefEndpoints = new Set<string>();

    // Pre-scan: count records blocks per table to detect duplicates
    const recordsTableCount = new Map<string, {
      count: number;
      tableName: string;
    }>();
    for (const meta of metadatas) {
      if (!(meta instanceof RecordsMetadata)) continue;
      const tableSymbol = meta.table(this.compiler);
      if (!tableSymbol) continue;
      const key = tableSymbol.originalSymbol.intern();
      const existing = recordsTableCount.get(key);
      if (existing) existing.count++;
      else recordsTableCount.set(key, {
        count: 1,
        tableName: tableSymbol.name ?? '',
      });
    }

    for (const meta of metadatas) {
      const result = this.compiler.interpretMetadata(meta, this.filepath);
      if (result.hasValue(UNHANDLED)) continue;
      this.errors.push(...result.getErrors());
      this.warnings.push(...result.getWarnings());
      const value = result.getValue();
      if (value === undefined) continue;
      switch (meta.kind) {
        case MetadataKind.Ref: {
          const ref = value as Ref;
          const [
            ep1,
            ep2,
          ] = ref.endpoints ?? [];
          if (ep1 && ep2) {
            const key = [
              ep1.schemaName,
              ep1.tableName,
              ep1.fieldNames.join(','),
              ep2.schemaName,
              ep2.tableName,
              ep2.fieldNames.join(','),
            ].join('|');
            const keyRev = [
              ep2.schemaName,
              ep2.tableName,
              ep2.fieldNames.join(','),
              ep1.schemaName,
              ep1.tableName,
              ep1.fieldNames.join(','),
            ].join('|');
            if (seenRefEndpoints.has(key) || seenRefEndpoints.has(keyRev)) {
              this.errors.push(new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Ref with same endpoints already exists', meta.declaration));
              break;
            }
            seenRefEndpoints.add(key);
          }
          this.db.refs.push(ref);
          break;
        }
        case MetadataKind.Records: {
          if (meta instanceof RecordsMetadata) {
            const tableSymbol = meta.table(this.compiler);
            const key = tableSymbol?.originalSymbol.intern() ?? '';
            const entry = key ? recordsTableCount.get(key) : undefined;
            if (entry && entry.count > 1) {
              this.errors.push(new CompileError(
                CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE,
                `Duplicate Records blocks for the same Table '${entry.tableName}' - A Table can only have one Records block`,
                meta.declaration,
              ));
              break;
            }
          }
          this.db.records.push(value as TableRecord);
          break;
        }
        case MetadataKind.Project:
          this.db.project = value as Project;
          break;
        default: break;
      }
    }
  }

  private interpretAllAliases () {
    const members = this.compiler.symbolMembers(this.programSymbol).getFiltered(UNHANDLED) ?? [];
    for (const member of members) {
      if (!(member instanceof AliasSymbol) || !member.isKind(SymbolKind.Table)) continue;
      const original = member.originalSymbol;
      const {
        name: tableName, schema: schemaName,
      } = original.interpretedName(this.compiler, this.filepath);
      const alias: Alias = {
        name: member.name,
        kind: AliasKind.Table,
        value: {
          tableName,
          schemaName,
        },
      };
      this.db.aliases.push(alias);
    }
  }

  private validateRecords (): CompileWarning[] {
    const warnings: CompileWarning[] = [];
    const fkTableMap = new Map<InternedNodeSymbol, TableInfo>();

    // Seed fkTableMap with ALL table symbols (record = undefined)
    const schemas = this.compiler.symbolMembers(this.programSymbol).getFiltered(UNHANDLED) ?? [];
    for (const schema of schemas) {
      if (!(schema instanceof SchemaSymbol)) continue;
      const members = this.compiler.symbolMembers(schema).getFiltered(UNHANDLED) ?? [];
      for (const member of members) {
        if (!member.isKind(SymbolKind.Table)) continue;
        const original = member.originalSymbol;
        if (!(original instanceof TableSymbol)) continue;
        const key = original.intern();
        if (!fkTableMap.has(key)) {
          fkTableMap.set(key, {
            tableSymbol: original,
            record: undefined,
            recordBlock: original.declaration,
          });
        }
      }
    }

    // Fill in records and run PK/unique validation
    const metadatas = this.compiler.symbolMetadata(this.programSymbol);
    for (const meta of metadatas) {
      if (!(meta instanceof RecordsMetadata)) continue;
      const tableSymbol = meta.table(this.compiler);
      if (!(tableSymbol instanceof TableSymbol)) continue;

      const result = this.compiler.interpretMetadata(meta, this.filepath);
      if (result.hasValue(UNHANDLED)) continue;
      const record = result.getValue() as TableRecord | undefined;
      if (!record) continue;

      warnings.push(...validatePrimaryKey(this.compiler, tableSymbol, meta.declaration, record));
      warnings.push(...validateUnique(this.compiler, tableSymbol, record));

      const key = tableSymbol.originalSymbol.intern();
      const entry = fkTableMap.get(key);
      if (entry) entry.record = record;
      else fkTableMap.set(key, {
        tableSymbol,
        record,
        recordBlock: meta.declaration,
      });
    }

    const partialRefs = this.collectPartialRefs(fkTableMap);
    warnings.push(...validateForeignKeys(this.compiler, [
      ...this.db.refs,
      ...partialRefs,
    ], fkTableMap, this.filepath));
    return warnings;
  }

  private collectPartialRefs (fkTableMap: Map<InternedNodeSymbol, TableInfo>): Ref[] {
    const partialMetas = this.compiler.symbolMetadata(this.programSymbol)
      .filter((m): m is PartialRefMetadata => m instanceof PartialRefMetadata);

    const refs: Ref[] = [];
    for (const {
      tableSymbol,
    } of fkTableMap.values()) {
      for (const partialSymbol of tableSymbol.resolvedPartials(this.compiler)) {
        for (const meta of partialMetas) {
          const container = meta.leftTablePartial(this.compiler);
          if (container?.originalSymbol !== partialSymbol.originalSymbol) continue;

          const leftColumns = meta.leftColumns(this.compiler);
          const rightTableOrPartial = meta.rightTable(this.compiler);
          const rightColumns = meta.rightColumns(this.compiler);
          const op = meta.op(this.compiler);
          if (!rightTableOrPartial || !op || leftColumns.length === 0 || rightColumns.length === 0) continue;

          // Skip if the column from the partial was not actually injected into this table
          // (e.g., overridden by a column defined earlier in the table)
          const mergedCols = tableSymbol.mergedColumns(this.compiler);
          const anyInjected = leftColumns.some((leftColumn) =>
            mergedCols.some((mergedColumns) => mergedColumns instanceof InjectedColumnSymbol && mergedColumns.declaration === leftColumn.declaration),
          );
          if (!anyInjected) continue;

          const multiplicities = getMultiplicities(op);
          if (!multiplicities) continue;

          // When rightTable is the partial itself (inline self-reference with bare column and no table prefix),
          // resolve it to the concrete table being expanded.
          const rightTable = rightTableOrPartial instanceof TablePartialSymbol
            && rightTableOrPartial.originalSymbol === partialSymbol.originalSymbol
            ? tableSymbol
            : rightTableOrPartial;

          const leftName = tableSymbol.interpretedName(this.compiler, this.filepath);
          const rightName = rightTable.interpretedName(this.compiler, this.filepath);

          const ep1: RefEndpoint = {
            schemaName: leftName.schema,
            tableName: leftName.name,
            fieldNames: leftColumns.map((c) => c.name ?? ''),
            relation: multiplicities[0],
            token: getTokenPosition(meta.leftToken()),
          };
          const ep2: RefEndpoint = {
            schemaName: rightName.schema,
            tableName: rightName.name,
            fieldNames: rightColumns.map((c) => c.name ?? ''),
            relation: multiplicities[1],
            token: getTokenPosition(meta.rightToken()),
          };
          refs.push({
            token: getTokenPosition(meta.declaration),
            endpoints: [
              ep1,
              ep2,
            ],
          } as Ref);
        }
      }
    }
    return refs;
  }

  private pushElement (symbol: NodeSymbol, value: SchemaElement | SchemaElement[]) {
    if (Array.isArray(value)) return;
    switch (symbol.kind) {
      case SymbolKind.Table:
        this.db.tables.push(value as Table);
        break;
      case SymbolKind.Enum:
        this.db.enums.push(value as Enum);
        break;
      case SymbolKind.TableGroup:
        this.db.tableGroups.push(value as TableGroup);
        break;
      case SymbolKind.TablePartial:
        this.db.tablePartials.push(value as TablePartial);
        break;
      case SymbolKind.StickyNote:
        this.db.notes.push(value as Note);
        break;
      case SymbolKind.DiagramView:
        this.db.diagramViews.push(value as DiagramView);
        break;
      default: break;
    }
  }
}
