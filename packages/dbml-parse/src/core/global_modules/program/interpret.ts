import Compiler from '@/compiler/index';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import type {
  CompileWarning,
} from '@/core/types/errors';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  CallExpressionNode,
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  AliasKind,
} from '@/core/types/schemaJson';
import type {
  Database, DiagramView, ElementRef, Enum, Note, Project, Ref, SchemaElement, Table, TableGroup, TablePartial, TableRecord,
} from '@/core/types/schemaJson';
import {
  type NodeSymbol, SchemaSymbol, SymbolKind, TableSymbol, UseSymbol,
} from '@/core/types/symbol';
import {
  MetadataKind,
  SymbolMetadata,
} from '@/core/types/metadata';
import {
  getBody,
} from '@/core/utils/expression';
import {
  isElementNode,
} from '@/core/utils/validate';
import {
  validateForeignKeys, validatePrimaryKey, validateUnique,
} from './utils/constraints';
import type {
  TableInfo,
} from './utils/constraints/fk';
import {
  makeTableKey,
} from './utils/constraints/helper';
import {
  extractInlineRefsFromTablePartials,
} from '../records/utils/interpret';
import {
  getTokenPosition,
} from '@/core/utils/interpret';
import {
  getMultiplicities,
} from '../utils';
import {
  pushExternal,
} from './utils';
import {
  ProjectInterpreter,
} from '../project/interpret';
import {
  RefInterpreter,
} from '../ref/interpret';
import RecordsInterpreter from '../records/interpret';

export default class ProgramInterpreter {
  private compiler: Compiler;
  private programNode: ProgramNode;
  private filepath: Filepath;
  private errors: CompileError[] = [];
  private warnings: CompileWarning[] = [];
  private recordsByTable = new Map<ElementDeclarationNode, ElementDeclarationNode[]>();
  private tableElements: ElementDeclarationNode[] = [];
  private db: Database;

  constructor (compiler: Compiler, node: ProgramNode, filepath?: Filepath) {
    this.compiler = compiler;
    this.programNode = node;
    this.filepath = filepath ?? node.filepath;
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
      token: getTokenPosition(node),
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
    // 1. Interpret this file's element declarations
    this.interpretDeclarations();

    // 2. Collect external references from use/reuse declarations
    this.collectExternals();

    // 3. Pull refs and records from imported table symbols via metadata
    this.collectExternalMetadata();

    // 4. Extract table aliases
    this.collectTableAliases();

    // 5. Convert inline refs from table fields
    this.collectInlineRefs();

    // 6. Validate duplicate records blocks
    this.checkDuplicateRecords();

    // 7. FK validation (unique, not null are handled inside binder of records)
    this.warnings.push(...this.validateRecords());

    return new Report(this.db, this.errors, this.warnings);
  }

  private interpretDeclarations () {
    for (const node of this.programNode.declarations) {
      const symbol = this.compiler.nodeSymbol(node).getFiltered(UNHANDLED);

      if (symbol) {
        const symResult = this.compiler.interpretSymbol(symbol, this.filepath);
        if (!symResult.hasValue(UNHANDLED)) {
          this.errors.push(...symResult.getErrors());
          this.warnings.push(...symResult.getWarnings());
          const value = symResult.getValue();
          if (value) {
            this.pushElement(node, value);
            continue;
          }
        }
      }

      // Metadata-based elements (ref, records, project) - interpret via metadata or directly
      const kind = node.getElementKind();
      if (kind === ElementKind.Ref) {
        const result = new RefInterpreter(this.compiler, node).interpret();
        this.errors.push(...result.getErrors());
        this.warnings.push(...result.getWarnings());
        const value = result.getValue();
        if (value) this.db.refs.push(value as Ref);
      } else if (kind === ElementKind.Project) {
        const result = new ProjectInterpreter(this.compiler, node).interpret();
        this.errors.push(...result.getErrors());
        this.warnings.push(...result.getWarnings());
        const value = result.getValue();
        if (value) this.db.project = value as Project;
      } else if (kind === ElementKind.Records) {
        const result = new RecordsInterpreter(this.compiler, node).interpret();
        this.errors.push(...result.getErrors());
        this.warnings.push(...result.getWarnings());
        const value = result.getValue();
        if (value) this.db.records.push(value as TableRecord);
        const referencedTable = this.compiler.nodeReferee((node.name as CallExpressionNode).callee!).getFiltered(UNHANDLED)?.declaration;
        if (referencedTable instanceof ElementDeclarationNode) this.pushRecordsToTable(referencedTable, node);
      }
    }
  }

  private pushElement (node: ElementDeclarationNode, value: SchemaElement | SchemaElement[]) {
    if (Array.isArray(value)) return;
    switch (node.getElementKind()) {
      case ElementKind.Table: {
        this.tableElements.push(node);
        this.db.tables.push(value as Table);
        for (const subElement of getBody(node)) {
          if (!isElementNode(subElement, ElementKind.Records)) continue;
          const result = new RecordsInterpreter(this.compiler, subElement as ElementDeclarationNode).interpret();
          this.pushRecordsToTable(node, subElement as ElementDeclarationNode);
          const record = result.getValue();
          if (record) this.db.records.push(record as TableRecord);
        }
        break;
      }
      case ElementKind.Enum:
        this.db.enums.push(value as Enum);
        break;
      case ElementKind.TableGroup:
        this.db.tableGroups.push(value as TableGroup);
        break;
      case ElementKind.TablePartial:
        this.db.tablePartials.push(value as TablePartial);
        break;
      case ElementKind.Note:
        this.db.notes.push(value as Note);
        break;
      case ElementKind.DiagramView:
        this.db.diagramViews.push(value as DiagramView);
        break;
      default: break;
    }
  }

  // Walk symbol members for UseSymbols  -- interpret each external element with filepath context
  private collectExternals () {
    const externalMap = new Map<string, ElementRef>();

    const programSymbol = this.compiler.nodeSymbol(this.programNode).getFiltered(UNHANDLED);
    if (!programSymbol) return;

    const schemas = this.compiler.symbolMembers(programSymbol).getFiltered(UNHANDLED)?.filter((s) => s instanceof SchemaSymbol) ?? [];

    for (const schema of schemas) {
      const members = this.compiler.symbolMembers(schema).getFiltered(UNHANDLED)?.filter((m) => m instanceof UseSymbol) ?? [];

      for (const member of members) {
        if (!member.usedSymbol) continue;
        const original = member.originalSymbol;
        const originalResolved = original.interpretedName(this.compiler);
        const memberResolved = member.interpretedName(this.compiler, this.filepath);

        const canonicalKey = original.intern();
        const visibleName = {
          schemaName: memberResolved.schema,
          name: memberResolved.name,
        };

        const existing = externalMap.get(canonicalKey);
        if (existing) {
          existing.visibleNames.push(visibleName);
        } else {
          const ref: ElementRef = {
            name: originalResolved.name,
            schemaName: originalResolved.schema,
            filepath: original.filepath,
            visibleNames: [
              visibleName,
            ],
          };
          externalMap.set(canonicalKey, ref);
          pushExternal(this.db, member, ref);
        }

        // Interpret the external element with this file's context
        const result = this.compiler.interpretSymbol(member, this.filepath);
        if (!result.hasValue(UNHANDLED)) {
          const value = result.getValue();
          if (value && !Array.isArray(value)) {
            this.pushExternalElement(member, value);
          }
        }

        // Auto-pull partial definitions referenced by imported tables
        if (member.usedSymbol?.isKind(SymbolKind.Table)) {
          this.pullTablePartials(original);
        }
      }
    }
  }

  // If an imported table uses ~partial_name, ensure the partial definition
  // is in db.tablePartials so dbml-core can expand it.
  private pullTablePartials (tableSymbol: NodeSymbol) {
    if (!(tableSymbol instanceof TableSymbol)) return;
    const existingNames = new Set(this.db.tablePartials.map((p) => p.name));

    for (const partialSymbol of tableSymbol.partialSymbols(this.compiler)) {
      const canonical = this.compiler.canonicalName(this.filepath, partialSymbol).getValue();
      const name = canonical?.name ?? partialSymbol.name;
      if (!name || existingNames.has(name)) continue;

      const result = this.compiler.interpretSymbol(partialSymbol, this.filepath);
      if (result.hasValue(UNHANDLED)) continue;
      const partial = result.getValue() as TablePartial | undefined;
      if (!partial) continue;

      partial.name = name;
      this.db.tablePartials.push(partial);
      existingNames.add(name);
    }
  }

  // Pull refs and records from external metadata.
  // Passes this.filepath to interpretMetadata so interpreters can use canonicalName.
  private collectExternalMetadata () {
    const normalizeSchema = (s: string | null | undefined): string =>
      (!s || s === DEFAULT_SCHEMA_NAME) ? '' : s;
    const inScopeTableNames = new Set(
      this.db.tables.map((t) => `${normalizeSchema(t.schemaName)}::${t.name}`),
    );

    // Collect external table symbols from the symbol graph
    const programSymbol = this.compiler.nodeSymbol(this.programNode).getFiltered(UNHANDLED);
    if (!programSymbol) return;
    const externalTableSymbols: NodeSymbol[] = [];
    for (const schema of this.compiler.symbolMembers(programSymbol).getFiltered(UNHANDLED) ?? []) {
      if (!(schema instanceof SchemaSymbol)) continue;
      for (const member of this.compiler.symbolMembers(schema).getFiltered(UNHANDLED) ?? []) {
        if (!member.isKind(SymbolKind.Table)) continue;
        if (member.originalSymbol.filepath.intern() === this.filepath.intern()) continue;
        externalTableSymbols.push(member.originalSymbol);
      }
    }

    // Targeted lookup: get metadata only for in-scope external table symbols
    // Dedup refs by declaration id (same ref indexed under both endpoint tables)
    const refsByDeclaration = new Map<number, SymbolMetadata>();

    for (const tableSymbol of externalTableSymbols) {
      for (const meta of this.compiler.symbolMetadata(tableSymbol)) {
        if (meta.kind === MetadataKind.Ref) {
          refsByDeclaration.set(meta.declaration.id, meta);
        }

        if (meta.kind === MetadataKind.Record) {
          const canonical = this.compiler.canonicalName(this.filepath, meta.target).getValue();
          if (!canonical) continue;
          if (!inScopeTableNames.has(`${normalizeSchema(canonical.schema)}::${canonical.name}`)) continue;

          const result = this.compiler.interpretMetadata(meta, this.filepath);
          if (result.hasValue(UNHANDLED)) continue;
          const record = result.getValue() as TableRecord | undefined;
          if (!record) continue;

          record.tableName = canonical.name;
          record.schemaName = canonical.schema || undefined;
          this.db.records.push(record);
        }
      }
    }

    // Interpret refs — RefInterpreter rewrites endpoints via canonicalName.
    for (const [
      , meta,
    ] of refsByDeclaration) {
      const result = this.compiler.interpretMetadata(meta, this.filepath);
      if (result.hasValue(UNHANDLED)) continue;
      const ref = result.getValue() as Ref | undefined;
      if (!ref?.endpoints?.length) continue;

      const allInScope = ref.endpoints.every((ep) =>
        inScopeTableNames.has(`${normalizeSchema(ep.schemaName)}::${ep.tableName}`),
      );
      if (allInScope) {
        this.db.refs.push(ref);
      }
    }
  }

  private pushExternalElement (member: UseSymbol, value: SchemaElement) {
    const kind = member.usedSymbol?.kind;
    switch (kind) {
      case SymbolKind.Table: this.db.tables.push(value as Table); break;
      case SymbolKind.Enum: this.db.enums.push(value as Enum); break;
      case SymbolKind.TableGroup: this.db.tableGroups.push(value as TableGroup); break;
      case SymbolKind.TablePartial: this.db.tablePartials.push(value as TablePartial); break;
      case SymbolKind.Note: this.db.notes.push(value as Note); break;
      default: break;
    }
  }

  private collectTableAliases () {
    for (const table of this.db.tables) {
      if (table.alias) {
        this.db.aliases.push({
          name: table.alias,
          kind: AliasKind.Table,
          value: {
            elementName: table.name,
            tableName: table.name,
            schemaName: table.schemaName,
          },
        });
      }
    }
  }

  private collectInlineRefs () {
    const inlineRefs: Ref[] = [];
    for (const table of this.db.tables) {
      for (const field of table.fields) {
        for (const inlineRef of field.inline_refs) {
          const cardinalities = getMultiplicities(inlineRef.relation);
          if (!cardinalities) continue;

          inlineRefs.push({
            name: null,
            schemaName: null,
            token: inlineRef.token,
            endpoints: [
              {
                schemaName: inlineRef.schemaName,
                tableName: inlineRef.tableName,
                fieldNames: inlineRef.fieldNames,
                relation: cardinalities[1],
                token: inlineRef.token,
              },
              {
                schemaName: table.schemaName,
                tableName: table.name,
                fieldNames: [
                  field.name,
                ],
                token: field.token,
                relation: cardinalities[0],
              },
            ],
          });
        }
      }
    }
    this.db.refs = [
      ...inlineRefs,
      ...this.db.refs,
    ];
  }

  private checkDuplicateRecords () {
    for (const [
      table,
      records,
    ] of this.recordsByTable) {
      if (records.length <= 1) continue;
      const tableName = this.compiler.nodeFullname(table).getFiltered(UNHANDLED)?.join('.') || '';
      const msg = `Duplicate Records blocks for the same Table '${tableName}' - A Table can only have one Records block`;
      for (const record of records) {
        this.errors.push(new CompileError(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE, msg, record));
      }
    }
  }

  // Validate record constraints (PK, unique, FK) for all tables.
  private validateRecords (): CompileWarning[] {
    const warnings: CompileWarning[] = [];
    const fkTableMap = new Map<string, TableInfo>();
    const allRefs: Ref[] = [
      ...this.db.refs,
    ];

    // Pre-index records by schema.table for O(1) lookup
    const recordsIndex = new Map<string, TableRecord>();
    for (const r of this.db.records) {
      recordsIndex.set(makeTableKey(r.schemaName ?? null, r.tableName), r);
    }

    for (const tableNode of this.tableElements) {
      const tableSymbol = this.compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
      if (!tableSymbol) continue;
      const table = this.compiler.interpretSymbol(tableSymbol, this.filepath).getValue() as Table;
      if (!table) continue;
      const key = makeTableKey(table.schemaName, table.name);
      const record = recordsIndex.get(key);
      const recordBlock = this.recordsByTable.get(tableNode)?.[0] ?? tableNode;

      // PK + unique validation (per-table, constraints derived from compiler queries)
      if (record) {
        warnings.push(...validatePrimaryKey(this.compiler, tableNode, recordBlock, record));
        warnings.push(...validateUnique(this.compiler, tableNode, record));
      }

      fkTableMap.set(key, {
        record,
        schemaName: table.schemaName,
        tableName: table.name,
        recordBlock,
      });
      allRefs.push(...extractInlineRefsFromTablePartials(table, this.db.tablePartials));
    }

    // FK validation (cross-table)
    warnings.push(...validateForeignKeys(this.compiler, allRefs, fkTableMap));
    return warnings;
  }

  private pushRecordsToTable (table: ElementDeclarationNode, records: ElementDeclarationNode) {
    if (!this.recordsByTable.has(table)) {
      this.recordsByTable.set(table, []);
    }
    this.recordsByTable.get(table)?.push(records);
  }
}
