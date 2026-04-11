import Compiler from '@/compiler/index';
import { CallExpressionNode, ElementDeclarationNode, ProgramNode } from '@/core/types/nodes';
import { ElementKind } from '@/core/types/keywords';
import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import Report from '@/core/types/report';
import type { Database, Ref, RefEndpoint, Table, TableRecord, SchemaElement, Enum, TableGroup, TablePartial, Note, Project } from '@/core/types/schemaJson';
import { getTokenPosition, getMultiplicities } from '../utils';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import type { CompileWarning } from '@/core/types/errors';
import { validateForeignKeys } from '../records/utils/constraints';
import { buildMergedTableFromElement, extractInlineRefsFromTablePartials } from '../records/utils/interpret';
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
        lengthParam: undefined,
        numericParams: undefined,
      },
    })),
  };
}

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
          this.tableElements.push(node);
          db.tables.push(processColumnInDb(value as Table));
          // interpret nested tables also
          for (const subElement of getBody(node)) {
            if (!(subElement instanceof ElementDeclarationNode) || !subElement.isKind(ElementKind.Records)) continue;
            const record = this.compiler.interpret(subElement).getFiltered(UNHANDLED);
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
          db.tablePartials.push(processColumnInDb(value as TablePartial));
          break;
        case ElementKind.Note:
          db.notes.push(value as Note);
          break;
        case ElementKind.Project:
          db.project = value as Project;
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
    for (const tableNode of this.tableElements) {
      const table = this.compiler.interpret(tableNode).getFiltered(UNHANDLED) as Table;
      const merged = buildMergedTableFromElement(tableNode, this.compiler);
      if (merged) mergedTables.set(table, merged);
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
    for (const [table, records] of this.recordsByTable) {
      if (records.length <= 1) continue;
      const tableName = this.compiler.fullname(table).getFiltered(UNHANDLED)?.join('.') || '';
      const msg = `Duplicate Records blocks for the same Table '${tableName}' - A Table can only have one Records block`;

      for (let i = 0; i < records.length; i++) {
        errors.push(new CompileError(
          CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE,
          msg,
          records[i],
        ));
      }
    }

    // Run FK validation once for all records now that all tables/refs/records are collected
    // Build a map of table info including merged tables (with partial columns) and record values.
    // Include ALL tables, even those without records (with empty values for FK target checking).
    const recordTableMap = new Map<string, { rows: TableRecord; mergedTable: Table }>();
    const allRefs: Ref[] = [...db.refs]; // Collect both table partial refs and table refs
    for (const table of db.tables) {
      const key = `${table.schemaName ?? DEFAULT_SCHEMA_NAME}.${table.name}`;
      const merged = mergedTables.get(table) ?? table;
      const record = db.records.find((r) => r.tableName === table.name && (r.schemaName ?? DEFAULT_SCHEMA_NAME) === (table.schemaName ?? DEFAULT_SCHEMA_NAME));
      recordTableMap.set(key, {
        rows: record ?? { schemaName: table.schemaName ?? undefined, tableName: table.name, columns: [], values: [], token: table.token },
        mergedTable: merged,
      });
      allRefs.push(...extractInlineRefsFromTablePartials(table, db.tablePartials));
    }
    warnings.push(...validateForeignKeys(allRefs, recordTableMap));

    return new Report(db, errors, warnings);
  }

  private pushRecordsToTable (table: ElementDeclarationNode, records: ElementDeclarationNode) {
    if (!this.recordsByTable.has(table)) {
      this.recordsByTable.set(table, []);
    }
    this.recordsByTable.get(table)?.push(records);
  }
}
