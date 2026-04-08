import Compiler from '@/compiler/index';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { ElementKind } from '@/core/types/keywords';
import { SymbolKind } from '@/core/types/symbols';
import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import Report from '@/core/report';
import type { Database, Ref, RefEndpoint, Table, TableRecord, SchemaElement, Enum, TableGroup, TablePartial, Note, Project } from '@/core/types/schemaJson';
import { getTokenPosition, getMultiplicities } from '../utils';
import { CompileError, CompileErrorCode } from '@/core/errors';
import type { CompileWarning } from '@/core/errors';
import { validateForeignKeys } from '../records/utils/constraints';
import { buildTableFromElement } from '../records/utils/interpret';
import { getBody } from '@/core/utils/expression';

// Strip internal-only properties from columns before exposing in the final Database output
function processColumnInDb<T extends Table | TablePartial> (table: T): T {
  return {
    ...table,
    fields: table.fields.map((c) => ({
      ...c,
      type: {
        ...c.type,
        isEnum: undefined,
      },
    })),
  };
}

export default class ProgramInterpreter {
  private compiler: Compiler;
  private programNode: ProgramNode;

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
      token,
    };

    for (const node of this.programNode.body) {
      if (!(node instanceof ElementDeclarationNode)) continue;

      const result = this.compiler.interpret(node);
      if (result.hasValue(UNHANDLED)) continue;
      errors.push(...result.getErrors());
      warnings.push(...result.getWarnings());

      const value = result.getValue();
      if (!value) continue;
      const kind = Object.values(ElementKind).find((k) => node.isKind(k));
      switch (kind) {
        case ElementKind.Table: {
          db.tables.push(processColumnInDb(value as Table));
          // interpret nested tables also
          for (const subElement of getBody(node)) {
            if (!(subElement instanceof ElementDeclarationNode) || !subElement.isKind(ElementKind.Records)) continue;
            const record = this.compiler.interpret(subElement).getFiltered(UNHANDLED);
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
          db.tablePartials.push(processColumnInDb(value as TablePartial));
          break;
        case ElementKind.Note:
          db.notes.push(value as Note);
          break;
        case ElementKind.Project:
          db.project = value as Project;
          break;
        case ElementKind.Records:
          db.records.push(value as TableRecord);
          break;
        default: break;
      }
    }

    // Extract table aliases
    for (const table of db.tables) {
      if (table.alias) {
        db.aliases.push({
          name: table.alias,
          kind: 'table' as const,
          value: { tableName: table.name, schemaName: table.schemaName },
        });
      }
    }

    // Build merged tables (with partial-injected fields) for FK validation and inline ref collection
    const mergedTables = new Map<Table, Table>();
    for (const table of db.tables) {
      // Find the table's AST node to build the merged version
      const tableNode = this.findTableNode(table);
      if (tableNode) {
        const merged = buildTableFromElement(tableNode, this.compiler);
        if (merged) mergedTables.set(table, merged);
      }
    }

    // Convert inline refs from table fields (including partial-injected) into top-level Ref objects
    // Inline refs are placed before standalone refs in the output
    const inlineRefs: Ref[] = [];
    for (const table of db.tables) {
      const merged = mergedTables.get(table) ?? table;
      for (const field of merged.fields) {
        for (const inlineRef of field.inline_refs) {
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
    {
      const recordsByTable = new Map<string, TableRecord[]>();
      for (const record of db.records) {
        const key = `${record.schemaName ?? DEFAULT_SCHEMA_NAME}.${record.tableName}`;
        if (!recordsByTable.has(key)) {
          recordsByTable.set(key, []);
        }
        recordsByTable.get(key)?.push(record);
      }
      for (const [, records] of recordsByTable) {
        if (records.length > 1) {
          const tableName = records[0].tableName;
          const msg = `Duplicate Records blocks for the same Table '${tableName}' - A Table can only have one Records block`;

          for (let i = 1; i < records.length; i++) {
            errors.push(new CompileError(
              CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE,
              msg,
              records[0],
            ));
          }
          for (let i = 1; i < records.length; i++) {
            errors.push(new CompileError(
              CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE,
              msg,
              records[i],
            ));
          }
        }
      }
    }

    // Run FK validation once for all records now that all tables/refs/records are collected
    // Build a map of table info including merged tables (with partial columns) and record values.
    // Include ALL tables, even those without records (with empty values for FK target checking).
    const recordTableMap = new Map<string, { rows: TableRecord; mergedTable: Table }>();
    for (const table of db.tables) {
      const key = `${table.schemaName ?? DEFAULT_SCHEMA_NAME}.${table.name}`;
      const merged = mergedTables.get(table) ?? table;
      const record = db.records.find((r) => r.tableName === table.name && (r.schemaName ?? DEFAULT_SCHEMA_NAME) === (table.schemaName ?? DEFAULT_SCHEMA_NAME));
      recordTableMap.set(key, {
        rows: record ?? { schemaName: table.schemaName ?? undefined, tableName: table.name, columns: [], values: [], token: table.token },
        mergedTable: merged,
      });
    }
    warnings.push(...validateForeignKeys(db.refs, recordTableMap));

    return new Report(db, errors, warnings);
  }

  private findTableNode (table: Table): ElementDeclarationNode | undefined {
    for (const element of this.programNode.body) {
      if (!(element instanceof ElementDeclarationNode)) continue;
      if (!element.isKind(ElementKind.Table)) continue;
      const fn = this.compiler.fullname(element);
      if (fn.hasValue(UNHANDLED)) continue;
      const fullname = fn.getValue();
      if (!fullname) continue;
      const name = fullname.at(-1);
      const schema = fullname.length > 1 ? fullname.slice(0, -1).join('.') : null;
      if (name === table.name && schema === table.schemaName) return element;
    }
    return undefined;
  }
}
