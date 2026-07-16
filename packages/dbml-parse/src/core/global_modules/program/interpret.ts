import Compiler from '@/compiler/index';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import type { CompileWarning } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { ProgramNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Alias, Database, Dep, DiagramView, Enum, Note, Project, Ref, SchemaElement, Table, TableGroup, TablePartial, TableRecord,
} from '@/core/types/schemaJson';
import { AliasKind } from '@/core/types/schemaJson';
import {
  AliasSymbol,
  type NodeSymbol,
  ProgramSymbol,
  SchemaSymbol,
  SymbolKind,
} from '@/core/types/symbol';
import { MetadataKind, RecordsMetadata, DepMetadata } from '@/core/types/symbol/metadata';
import { TableSymbol } from '@/core/types/symbol';
import { UseSymbol } from '@/core/types/symbol/symbols';
import { pushExternal, validateRecords, validateDepBlocks } from './utils';
import type { ElementRef } from '@/core/types/schemaJson';
import { getTokenPosition } from '@/core/utils/interpret';

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
      deps: [],
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
    this.warnings.push(...validateRecords(this.compiler, this.programSymbol, this.db.refs, this.filepath));
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

    // Keep track of all encountered schemas while interpreting
    const schemaQueue = schemas.filter((s): s is SchemaSymbol => s instanceof SchemaSymbol);
    while (schemaQueue.length > 0) {
      const schema = schemaQueue.shift()!;
      const members = this.compiler.symbolMembers(schema).getFiltered(UNHANDLED) ?? [];
      for (const member of members) {
        if (member instanceof SchemaSymbol) {
          schemaQueue.push(member);
          continue;
        }
        if (!(member instanceof UseSymbol)) continue;

        // Check if we've already interpreted this
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
    const seenDepEndpoints = new Set<string>();
    const seenDownstream = new Map<string, boolean>();

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
        case MetadataKind.Dep: {
          const dep = value as Dep;
          // Per-edge `a -> b` nodes, index-aligned with dep.edges, for a precise error location.
          const edgeNodes = meta instanceof DepMetadata ? meta.edgeExpressions() : [];
          // Directed src-target uniqueness: a -> b and b -> a are distinct, so no reverse key.
          let duplicateEdgeIndex = -1;
          (dep.edges ?? []).some((edge, i) => {
            const { upstream: up, downstream: down } = edge;
            const key = [
              up.schemaName,
              up.tableName,
              up.fieldNames.join(','),
              down.schemaName,
              down.tableName,
              down.fieldNames.join(','),
            ].join('|');
            if (seenDepEndpoints.has(key)) {
              duplicateEdgeIndex = i;
              return true;
            }
            seenDepEndpoints.add(key);
            return false;
          });
          if (duplicateEdgeIndex >= 0) {
            // Point at the duplicate `a -> b` line; fall back to the whole declaration (inline form).
            const errorNode = edgeNodes[duplicateEdgeIndex] ?? meta.declaration;
            this.errors.push(new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Dep with same endpoints already exists', errorNode));
            break;
          }
          const depErrors = validateDepBlocks(dep, meta, seenDownstream);
          if (depErrors.length > 0) {
            this.errors.push(...depErrors);
            break;
          }
          this.db.deps.push(dep);
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
