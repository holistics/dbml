import Compiler from '@/compiler/index';
import {
  CallExpressionNode, ElementDeclarationNode, ProgramNode, UseSpecifierListNode, UseSpecifierNode,
} from '@/core/types/nodes';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  DEFAULT_SCHEMA_NAME, UNHANDLED,
} from '@/constants';
import Report from '@/core/types/report';
import {
  AliasKind,
} from '@/core/types/schemaJson';
import type {
  Database, DiagramView, ElementRef, Ref, RefEndpoint, Table, TableRecord, SchemaElement, Enum, TableGroup, TablePartial, Note, Project,
} from '@/core/types/schemaJson';
import {
  getTokenPosition, getMultiplicities,
} from '../utils';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import type {
  CompileWarning,
} from '@/core/types/errors';
import {
  validateForeignKeys,
} from '../records/utils/constraints';
import {
  buildMergedTableFromElement, extractInlineRefsFromTablePartials,
} from '../records/utils/interpret';
import {
  getBody,
} from '@/core/utils/expression';
import {
  UseSymbol, SymbolKind, SchemaSymbol,
} from '@/core/types/symbol';

export default class ProgramInterpreter {
  private compiler: Compiler;
  private programNode: ProgramNode;
  private recordsByTable = new Map<ElementDeclarationNode, ElementDeclarationNode[]>(); // to track duplicated records for a table
  private tableElements: ElementDeclarationNode[] = [];

  constructor (compiler: Compiler, node: ProgramNode) {
    this.compiler = compiler;
    this.programNode = node;
  }

  interpret (): Report<SchemaElement | SchemaElement[] | undefined> {
    const token = getTokenPosition(this.programNode);
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];
    const db: Database = {
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
      token,
      externals: {
        tables: [],
        enums: [],
        tableGroups: [],
        tablePartials: [],
        notes: [],
      },
    };

    // Process only this file's own element declarations
    for (const node of this.programNode.declarations) {
      const result = this.compiler.interpretNode(node);
      if (result.hasValue(UNHANDLED)) continue;
      errors.push(...result.getErrors());
      warnings.push(...result.getWarnings());

      const value = result.getValue();
      if (!value) continue;
      const kind = Object.values(ElementKind).find((k) => node.isKind(k));
      this.collectElementToDb(db, kind, node, value);
    }

    // Collect external references from use/reuse declarations.
    // UseSymbols are the symbols of UseSpecifierNodes — not members of the program scope —
    // so we walk the use declarations directly instead of going through symbolMembers.
    // Group by canonical (kind + schema + name) so multiple imports of the same element
    // accumulate into a single ElementRef with multiple visibleNames.
    {
      const extMap = new Map<string, ElementRef>();

      const listForKind = (member: UseSymbol): ElementRef[] | undefined => {
        if (member.isKind(SymbolKind.Table)) return db.externals.tables;
        if (member.isKind(SymbolKind.Enum)) return db.externals.enums;
        if (member.isKind(SymbolKind.TableGroup)) return db.externals.tableGroups;
        if (member.isKind(SymbolKind.TablePartial)) return db.externals.tablePartials;
        if (member.isKind(SymbolKind.Note)) return db.externals.notes;
        return undefined;
      };

      const kindKey = (member: UseSymbol): string => {
        if (member.isKind(SymbolKind.Table)) return ElementKind.Table;
        if (member.isKind(SymbolKind.Enum)) return ElementKind.Enum;
        if (member.isKind(SymbolKind.TableGroup)) return ElementKind.TableGroup;
        if (member.isKind(SymbolKind.TablePartial)) return ElementKind.TablePartial;
        if (member.isKind(SymbolKind.Note)) return ElementKind.Note;
        return '';
      };

      for (const useDecl of this.programNode.uses) {
        if (!(useDecl.specifiers instanceof UseSpecifierListNode)) continue;
        for (const spec of useDecl.specifiers.specifiers) {
          const member = this.compiler.nodeSymbol(spec).getFiltered(UNHANDLED);
          if (!(member instanceof UseSymbol)) continue;
          const name = member.usedSymbol ? this.compiler.symbolName(member.usedSymbol) : undefined;
          if (!name) continue;
          const list = listForKind(member);
          if (!list) continue;

          const localName = this.compiler.symbolName(member) ?? name;
          const schemaName = member.usedSymbol?.declaration
            ? (this.compiler.nodeFullname(member.usedSymbol.declaration).getFiltered(UNHANDLED)?.slice(0, -1).join('.') || null)
            : null;

          // Direct imports retain the original schemaName.
          // Explicit aliases replace schema with null.
          const isDirect = localName === name;
          const visibleName = isDirect
            ? {
                schemaName,
                name: localName,
              }
            : {
                schemaName: null,
                name: localName,
              };

          const canonicalKey = `${kindKey(member)}:${schemaName ?? ''}.${name}`;
          if (extMap.has(canonicalKey)) {
            extMap.get(canonicalKey)!.visibleNames.push(visibleName);
          } else {
            const ref: ElementRef = {
              name,
              schemaName,
              visibleNames: [visibleName],
            };
            extMap.set(canonicalKey, ref);
            list.push(ref);
          }
        }
      }

      // Wildcard imports are not enumerated at the AST level — every importable
      // member becomes a synthesized UseSymbol in `schemaModule.symbolMembers`.
      // Walk the public schema to pick those up so they land in `externals`.
      const publicSchema = this.compiler.lookupMembers(this.programNode, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue();
      if (publicSchema instanceof SchemaSymbol) {
        const schemaMembers = this.compiler.symbolMembers(publicSchema).getFiltered(UNHANDLED) ?? [];
        for (const member of schemaMembers) {
          if (!(member instanceof UseSymbol)) continue;
          // Selective specs are already handled above; skip them here to avoid
          // duplicating the per-spec visibleName accounting.
          if (member.useSpecifierDeclaration instanceof UseSpecifierNode) continue;
          const name = member.usedSymbol ? this.compiler.symbolName(member.usedSymbol) : undefined;
          if (!name) continue;
          const list = listForKind(member);
          if (!list) continue;

          const schemaName = member.usedSymbol?.declaration
            ? (this.compiler.nodeFullname(member.usedSymbol.declaration).getFiltered(UNHANDLED)?.slice(0, -1).join('.') || null)
            : null;

          const canonicalKey = `${kindKey(member)}:${schemaName ?? ''}.${name}`;
          if (extMap.has(canonicalKey)) continue; // already covered by selective import
          const ref: ElementRef = {
            name,
            schemaName,
            visibleNames: [{
              schemaName,
              name,
            }],
          };
          extMap.set(canonicalKey, ref);
          list.push(ref);
        }
      }
    }

    // Extract table aliases
    for (const table of db.tables) {
      if (table.alias) {
        db.aliases.push({
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

    // Filter metadata (refs, records, tableGroups) based on available tables/schemas
    this.filterMetadata(db);

    // Build merged tables (with partial-injected fields) for FK validation and inline ref collection
    const mergedTables = new Map<Table, Table>();
    for (const tableNode of this.tableElements) {
      const table = db.tables.find((t) => t.name === (this.compiler.interpretNode(tableNode).getValue() as Table).name); // Simplified lookup
      if (!table) continue;
      const merged = buildMergedTableFromElement(tableNode, this.compiler);
      if (merged) mergedTables.set(table, merged);
    }

    // Convert inline refs from direct table fields only
    // Partial-injected field refs are handled separately by extractInlineRefsFromTablePartials
    const inlineRefs: Ref[] = [];
    for (const table of db.tables) {
      for (const field of table.fields) {
        for (const inlineRef of field.inline_refs) {
          if (!this.isTableVisible(db, inlineRef.schemaName, inlineRef.tableName)) continue;

          const cardinalities = getMultiplicities(inlineRef.relation);
          if (!cardinalities) continue;

          const leftEndpoint: RefEndpoint = {
            schemaName: table.schemaName,
            tableName: table.name,
            fieldNames: [field.name],
            token: field.token,
            relation: cardinalities[0],
          };

          const rightEndpoint: RefEndpoint = {
            schemaName: inlineRef.schemaName,
            tableName: inlineRef.tableName,
            fieldNames: inlineRef.fieldNames,
            relation: cardinalities[1],
            token: inlineRef.token,
          };

          const ref: Ref = {
            name: null,
            schemaName: null,
            token: inlineRef.token,
            endpoints: [rightEndpoint, leftEndpoint],
          };
          inlineRefs.push(ref);
        }
      }
    }
    db.refs = [...inlineRefs, ...db.refs];

    // Validate duplicate records blocks for the same table
    for (const [table, records] of this.recordsByTable) {
      if (records.length <= 1) continue;
      const tableName = this.compiler.nodeFullname(table).getFiltered(UNHANDLED)?.join('.') || '';
      const msg = `Duplicate Records blocks for the same Table '${tableName}' - A Table can only have one Records block`;

      for (let i = 0; i < records.length; i++) {
        errors.push(new CompileError(
          CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE,
          msg,
          records[i],
        ));
      }
    }

    // Run FK validation
    const recordTableMap = new Map<string, { rows: TableRecord;
      mergedTable: Table; }>();
    const allRefs: Ref[] = [...db.refs]; // Collect both table partial refs and table refs
    for (const table of db.tables) {
      const key = `${table.schemaName ?? DEFAULT_SCHEMA_NAME}.${table.name}`;
      const merged = mergedTables.get(table) ?? table;
      const record = db.records.find((r) => r.tableName === table.name && (r.schemaName ?? DEFAULT_SCHEMA_NAME) === (table.schemaName ?? DEFAULT_SCHEMA_NAME));
      recordTableMap.set(key, {
        rows: record ?? {
          schemaName: table.schemaName ?? undefined,
          tableName: table.name,
          columns: [],
          values: [],
          token: table.token,
        },
        mergedTable: merged,
      });
      allRefs.push(...extractInlineRefsFromTablePartials(table, db.tablePartials));
    }
    warnings.push(...validateForeignKeys(allRefs, recordTableMap));

    return new Report(db, errors, warnings);
  }

  private collectElementToDb (db: Database, kind: ElementKind | undefined, node: ElementDeclarationNode, value: SchemaElement | SchemaElement[]) {
    switch (kind) {
      case ElementKind.Table: {
        this.tableElements.push(node);
        db.tables.push(value as Table);
        // interpret nested tables also
        for (const subElement of getBody(node)) {
          if (!(subElement instanceof ElementDeclarationNode) || !subElement.isKind(ElementKind.Records)) continue;
          const record = this.compiler.interpretNode(subElement).getFiltered(UNHANDLED);
          this.pushRecordsToTable(node, subElement);
          if (record) db.records.push(record as TableRecord);
        }
        break;
      }
      case ElementKind.Ref:
        db.refs.push(value as Ref);
        break;
      case ElementKind.Enum:
        db.enums.push(value as Enum);
        break;
      case ElementKind.TableGroup:
        db.tableGroups.push(value as TableGroup);
        break;
      case ElementKind.TablePartial:
        db.tablePartials.push(value as TablePartial);
        break;
      case ElementKind.Note:
        db.notes.push(value as Note);
        break;
      case ElementKind.Project:
        db.project = value as Project;
        break;
      case ElementKind.DiagramView:
        db.diagramViews.push(value as DiagramView);
        break;
      case ElementKind.Records: {
        db.records.push(value as TableRecord);
        const referencedTable = this.compiler.nodeReferee((node.name as CallExpressionNode).callee!).getFiltered(UNHANDLED)?.declaration;
        if (referencedTable instanceof ElementDeclarationNode) this.pushRecordsToTable(referencedTable, node);
        break;
      }
      default: break;
    }
  }

  private filterMetadata (db: Database) {
    // Filter refs: both endpoints must exist in db.tables
    db.refs = db.refs.filter((ref) => ref.endpoints.every((ep) => this.isTableVisible(db, ep.schemaName, ep.tableName)));

    // Filter records: table must exist in db.tables
    db.records = db.records.filter((rec) => this.isTableVisible(db, rec.schemaName ?? null, rec.tableName));

    // Filter tableGroups: keep only table entries that exist in db.tables, but keep the group itself even if empty
    db.tableGroups.forEach((tg) => {
      tg.tables = tg.tables.filter((t) => this.isTableVisible(db, t.schemaName, t.name));
    });
  }

  private isTableVisible (db: Database, schemaName: string | null, tableName: string): boolean {
    const sName = schemaName ?? DEFAULT_SCHEMA_NAME;
    // Check local tables
    if (db.tables.some((t) => t.name === tableName && (t.schemaName ?? DEFAULT_SCHEMA_NAME) === sName)) return true;
    // Check imported tables (via use/reuse), any visible name matches
    if (db.externals.tables.some((t) => t.visibleNames.some(
      (v) => v.name === tableName && (v.schemaName ?? DEFAULT_SCHEMA_NAME) === sName,
    ))) return true;
    // Check aliases (schemaName is null for aliases)
    if (schemaName === null && db.aliases.some((a) => a.name === tableName)) return true;
    return false;
  }

  private pushRecordsToTable (table: ElementDeclarationNode, records: ElementDeclarationNode) {
    if (!this.recordsByTable.has(table)) {
      this.recordsByTable.set(table, []);
    }
    this.recordsByTable.get(table)?.push(records);
  }
}
