import Compiler from '@/compiler/index';
import {
  CompileError, CompileErrorCode, CompileWarning, type CompileInfo,
} from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { ElementDeclarationNode, ProgramNode, type SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Alias, Database, Dep, DiagramView, Enum,
  Group, Kind, Link, Node, Note, NoteBox, Project, Ref,
  RefEndpoint, SchemaElement, Table,
  TableGroup, TablePartial, TableRecord,
} from '@/core/types/schemaJson';
import { AliasKind } from '@/core/types/schemaJson';
import {
  AliasSymbol,
  type NodeSymbol,
  ProgramSymbol,
  SchemaSymbol,
  SymbolKind,
} from '@/core/types/symbol';
import {
  MetadataKind, PartialRefMetadata, RecordsMetadata, DepMetadata,
} from '@/core/types/symbol/metadata';
import { TableSymbol } from '@/core/types/symbol';
import type { InternedNodeSymbol } from '@/core/types/symbol/symbols';
import {
  InjectedColumnSymbol,
  TablePartialSymbol,
  UseSymbol,
} from '@/core/types/symbol/symbols';
import { pushExternal, validateDepBlocks } from './utils';
import {
  archSort, bodyOf, declarationWord, isTopLevel, nameOf, rowOf,
} from '@/core/arch/read';
import { builtinKinds } from '../arch/interpret';
import type { ElementRef } from '@/core/types/schemaJson';
import { getTokenPosition } from '@/core/utils/interpret';
import { getMultiplicities } from '@/core/types/relation';
import { validatePartialRef } from '../ref/constraint_fixes';
import { validateForeignKeys, validatePrimaryKey, validateUnique } from '../records/utils/constraints';
import type { TableInfo } from '../records/utils/constraints/fk';

export default class ProgramInterpreter {
  private compiler: Compiler;
  private programSymbol: ProgramSymbol;
  private programNode: ProgramNode;
  private filepath: Filepath;
  private errors: CompileError[] = [];
  private warnings: CompileWarning[] = [];
  private infos: CompileInfo[] = [];
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
    this.validatePartialRefs();
    this.infos.push(...this.validateRecords());
    this.finishArch();
    return new Report(this.db, this.errors, this.warnings, this.infos);
  }

  // Architecture entries, filled while interpreting and written to `db` at the end
  private arch = {
    nodes: [] as Node[],
    groups: [] as Group[],
    noteBoxes: [] as NoteBox[],
    links: [] as {
      link: Link;
      declaration: SyntaxNode;
    }[],
    kinds: [] as Kind[],
    importedKinds: [] as Kind[],
  };

  private finishArch () {
    const isArch = this.compiler.parsedFileKind(this.filepath) === 'arch';

    // A `Kind` in this file overrules an imported one and a built-in; a later one overrules an earlier one
    const kinds = new Map<string, Kind>();
    for (const kind of this.arch.kinds) kinds.set(kind.name.toLowerCase(), kind);
    for (const kind of this.arch.importedKinds) {
      if (!kinds.has(kind.name.toLowerCase())) kinds.set(kind.name.toLowerCase(), kind);
    }
    // a DBML file that imports nodes needs the built-in roles to draw them
    if (isArch || this.arch.nodes.length) {
      for (const kind of builtinKinds()) {
        if (!kinds.has(kind.name.toLowerCase())) kinds.set(kind.name.toLowerCase(), kind);
      }
    }

    // The first group to list an element owns it
    const handles = new Set([
      ...this.arch.nodes,
      ...this.arch.groups,
      ...this.arch.noteBoxes,
    ].map((e) => e.alias ?? e.name));
    const parent = new Map<string, string>();
    for (const group of this.arch.groups) {
      const handle = group.alias ?? group.name;
      for (const child of group.children) {
        if (handles.has(child) && !parent.has(child)) parent.set(child, handle);
      }
    }
    for (const group of this.arch.groups) {
      const handle = group.alias ?? group.name;
      group.children = group.children.filter((child) => parent.get(child) === handle);
    }

    // A repeated link, or a link into its own container, still draws, with a warning
    const seen = new Set<string>();
    for (const { link, declaration } of this.arch.links) {
      const key = [
        link.from,
        link.to,
      ].sort().join('\u0000');
      if (seen.has(key)) {
        this.warnings.push(new CompileWarning(CompileErrorCode.DUPLICATE_LINK, `${link.from} and ${link.to} are already connected`, declaration));
      }
      seen.add(key);
      if (parent.get(link.from) === link.to || parent.get(link.to) === link.from) {
        this.warnings.push(new CompileWarning(CompileErrorCode.NESTED_ENDPOINTS, `${link.from} is already inside ${link.to}`, declaration));
      }
    }

    const entries = {
      nodes: this.arch.nodes,
      groups: this.arch.groups,
      noteBoxes: this.arch.noteBoxes,
      links: this.arch.links.map(({ link }) => link),
      kinds: [
        ...kinds.values(),
      ],
    };
    for (const [key, value] of Object.entries(entries) as [keyof typeof entries, never[]][]) {
      if (isArch || value.length) this.db[key] = value;
    }

    const frontMatter = {
      ...this.compiler.scanFile(this.filepath).frontMatter,
      ...(isArch ? projectRowsOf(this.programNode) : {}),
    };
    if (Object.keys(frontMatter).length) this.db.frontMatter = frontMatter;
    if (isArch) this.db.diagramType = 'arch';
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
      this.infos.push(...result.getInfos());
      const value = result.getValue();
      if (value) this.pushElement(symbol, value);
    }

    // 1b UseSymbols (imports) from schema members
    // The same original symbol may appear in multiple schemas, only interpret each original once
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
      this.infos.push(...result.getInfos());
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
      this.infos.push(...result.getInfos());
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
          // Per-edge nodes aligned with dep.edges, for precise error location
          const edgeNodes = meta instanceof DepMetadata ? meta.edgeExpressions() : [];
          // a -> b and b -> a are distinct (directed), so no reverse key
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
            // Point at the duplicate edge node, fall back to the whole declaration for inline form
            const errorNode = edgeNodes[duplicateEdgeIndex] ?? meta.declaration;
            this.errors.push(new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Dep with same endpoints already exists', errorNode));
            break;
          }
          const depErrors = validateDepBlocks(dep, meta);
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
        case MetadataKind.Link:
          this.arch.links.push({
            link: value as Link,
            declaration: meta.declaration,
          });
          break;

        // Handled inside each element
        case MetadataKind.MetadataElement:
        default:
          break;
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

  private validateRecords (): CompileInfo[] {
    const infos: CompileInfo[] = [];
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

      infos.push(...validatePrimaryKey(this.compiler, tableSymbol, meta.declaration, record));
      infos.push(...validateUnique(this.compiler, tableSymbol, record));

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
    infos.push(...validateForeignKeys(this.compiler, [
      ...this.db.refs,
      ...partialRefs,
    ], fkTableMap, this.filepath));
    return infos;
  }

  private validatePartialRefs () {
    const partialMetas = this.compiler.symbolMetadata(this.programSymbol)
      .filter((m): m is PartialRefMetadata => m instanceof PartialRefMetadata);
    for (const meta of partialMetas) {
      this.infos.push(...validatePartialRef(this.compiler, meta));
    }
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
          // resolve it to the concrete table being expanded
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
      case SymbolKind.Element: {
        const sort = archSort(symbol.originalSymbol.declaration!);
        if (sort === 'group') this.arch.groups.push(value as Group);
        else if (sort === 'note') this.arch.noteBoxes.push(value as NoteBox);
        else this.arch.nodes.push(value as Node);
        break;
      }
      case SymbolKind.Kind:
        if (symbol instanceof UseSymbol) this.arch.importedKinds.push(value as Kind);
        else this.arch.kinds.push(value as Kind);
        break;
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

// An architecture file's `Project` rows join its front matter keys; `diagram_type` there is an error, not a key
function projectRowsOf (program: ProgramNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const declaration of program.body) {
    if (!isTopLevel(declaration) || archSort(declaration) !== 'project') continue;
    for (const row of bodyOf(declaration)) {
      let key: string | undefined;
      let value: string | undefined;
      if (row instanceof ElementDeclarationNode) {
        key = declarationWord(row)?.toLowerCase();
        value = nameOf(rowOf(bodyOf(row)[0])?.callee);
      } else {
        const parsed = rowOf(row);
        key = nameOf(parsed?.callee)?.toLowerCase();
        value = nameOf(parsed?.args[0]);
      }
      if (!key || key === 'diagram_type' || value === undefined) continue;
      out[key] = value;
    }
  }
  return out;
}
