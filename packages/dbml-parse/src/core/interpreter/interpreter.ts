import { ProgramNode } from '@/core/parser/nodes';
import { Database, InterpreterDatabase, Table, TablePartial, TableRecord } from '@/core/interpreter/types';
import { TableInterpreter } from '@/core/interpreter/elementInterpreter/table';
import { StickyNoteInterpreter } from '@/core/interpreter/elementInterpreter/sticky_note';
import { RefInterpreter } from '@/core/interpreter/elementInterpreter/ref';
import { TableGroupInterpreter } from '@/core/interpreter/elementInterpreter/tableGroup';
import { EnumInterpreter } from '@/core/interpreter/elementInterpreter/enum';
import { ProjectInterpreter } from '@/core/interpreter/elementInterpreter/project';
import { TablePartialInterpreter } from '@/core/interpreter/elementInterpreter/tablePartial';
import { DiagramViewInterpreter } from '@/core/interpreter/elementInterpreter/diagramView';
import { RecordsInterpreter } from '@/core/interpreter/records';
import Report from '@/core/report';
import { getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { CompileWarning } from '../errors';
import { DEFAULT_SCHEMA_NAME } from '@/constants';

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

/**
 * Entity types whose explicit wildcard (*) must be expanded to the concrete list of names.
 * These types have no "show all" sentinel in FilterConfig — consumers expect
 * an explicit list. Add more types here as needed.
 */
const WILDCARD_EXPAND_ENTITIES = new Set(['tableGroups']);

/**
 * Expand explicit wildcard ([]) in DiagramView visibleEntities to the actual list of
 * entities for the types listed in WILDCARD_EXPAND_ENTITIES.
 *
 * Only expands when:
 * 1. The user wrote `{ * }` for that entity type (tracked via _explicitWildcards)
 * 2. The other Trinity dims (Tables, Schemas) are NOT explicitly set —
 *    i.e. the wildcard entity is the only Trinity dim declared.
 *    When other Trinity dims are also declared, [] keeps its "show all" meaning.
 */
function expandDiagramViewWildcards (env: InterpreterDatabase): void {
  if (!env.diagramViews) return;

  for (const view of env.diagramViews.values()) {
    const ve = view.visibleEntities;
    const wildcards = view._explicitWildcards;
    const explicitlySet = view._explicitlySet;
    if (!wildcards || !explicitlySet) continue;

    if (WILDCARD_EXPAND_ENTITIES.has('tables') && wildcards.has('tables') && ve.tables && ve.tables.length === 0) {
      const otherTrinitySet = explicitlySet.has('tableGroups') || explicitlySet.has('schemas');
      if (!otherTrinitySet) {
        ve.tables = Array.from(env.tables.values()).map((t) => ({
          name: t.name,
          schemaName: t.schemaName || DEFAULT_SCHEMA_NAME,
        }));
      }
    }

    if (WILDCARD_EXPAND_ENTITIES.has('tableGroups') && wildcards.has('tableGroups') && ve.tableGroups && ve.tableGroups.length === 0) {
      const otherTrinitySet = explicitlySet.has('tables') || explicitlySet.has('schemas');
      if (!otherTrinitySet) {
        ve.tableGroups = Array.from(env.tableGroups.values()).map((tg) => ({
          name: tg.name!,
        }));
      }
    }

    if (WILDCARD_EXPAND_ENTITIES.has('stickyNotes') && wildcards.has('stickyNotes') && ve.stickyNotes && ve.stickyNotes.length === 0) {
      // stickyNotes is not part of Trinity, no other-dim check needed
      ve.stickyNotes = Array.from(env.notes.values()).map((n) => ({
        name: n.name,
      }));
    }

    if (WILDCARD_EXPAND_ENTITIES.has('schemas') && wildcards.has('schemas') && ve.schemas && ve.schemas.length === 0) {
      const otherTrinitySet = explicitlySet.has('tables') || explicitlySet.has('tableGroups');
      if (!otherTrinitySet) {
        ve.schemas = [...new Set(
          Array.from(env.tables.values()).map((t) => t.schemaName || DEFAULT_SCHEMA_NAME),
        )].map((name) => ({ name }));
      }
    }

    // Clean up internal markers before output
    delete view._explicitWildcards;
    delete view._explicitlySet;
  }
}

function convertEnvToDb (env: InterpreterDatabase): Database {
  // Convert records Map to array of TableRecord
  const records: TableRecord[] = [];
  for (const [table, block] of env.records) {
    if (!block.length) continue;
    const columns = Object.keys(block[0].columnNodes);
    records.push({
      schemaName: table.schemaName || undefined,
      tableName: table.name,
      columns,
      values: block.map((r) => {
        // Convert object-based values to array-based values ordered by columns
        return columns.map((col) => {
          const val = r.values[col];
          if (val) {
            return { value: val.value, type: val.type };
          }
          return { value: null, type: 'expression' };
        });
      }),
    });
  }

  return {
    schemas: [],
    tables: Array.from(env.tables.values()).map(processColumnInDb),
    notes: Array.from(env.notes.values()),
    refs: Array.from(env.ref.values()),
    enums: Array.from(env.enums.values()),
    tableGroups: Array.from(env.tableGroups.values()),
    aliases: env.aliases,
    project: Array.from(env.project.values())[0] || {},
    tablePartials: Array.from(env.tablePartials.values()).map(processColumnInDb),
    records,
    diagramViews: env.diagramViews ? Array.from(env.diagramViews.values()) : [],
  };
}

// The interpreted format follows the old parser
export default class Interpreter {
  ast: ProgramNode;
  env: InterpreterDatabase;

  constructor (ast: ProgramNode) {
    this.ast = ast;
    this.env = {
      schema: [],
      tables: new Map(),
      notes: new Map(),
      refIds: { },
      ref: new Map(),
      enums: new Map(),
      tableOwnerGroup: { },
      tableGroups: new Map(),
      aliases: [],
      project: new Map(),
      tablePartials: new Map(),
      records: new Map(),
      recordsElements: [],
      cachedMergedTables: new Map(),
      source: ast.source,
      diagramViews: new Map(),
    };
  }

  interpret (): Report<Database> {
    // First pass: interpret all non-records elements
    const errors = this.ast.body.flatMap((element) => {
      switch (getElementKind(element).unwrap_or(undefined)) {
        case ElementKind.Table:
          return (new TableInterpreter(element, this.env)).interpret();
        case ElementKind.Note:
          return (new StickyNoteInterpreter(element, this.env)).interpret();
        case ElementKind.Ref:
          return (new RefInterpreter(element, this.env)).interpret();
        case ElementKind.TableGroup:
          return (new TableGroupInterpreter(element, this.env)).interpret();
        case ElementKind.TablePartial:
          return (new TablePartialInterpreter(element, this.env)).interpret();
        case ElementKind.Enum:
          return (new EnumInterpreter(element, this.env)).interpret();
        case ElementKind.Project:
          return (new ProjectInterpreter(element, this.env)).interpret();
        case ElementKind.DiagramView:
          return (new DiagramViewInterpreter(element, this.env)).interpret();
        case ElementKind.Records:
          // Defer records interpretation - collect for later
          this.env.recordsElements.push(element);
          return [];
        default:
          return [];
      }
    });

    const warnings: CompileWarning[] = [];
    if (this.env.recordsElements.length) {
    // Second pass: interpret all records elements grouped by table
    // Now that all tables, enums, etc. are interpreted, we can validate records properly
      const recordsResult = new RecordsInterpreter(this.env).interpret(this.env.recordsElements);
      errors.push(...recordsResult.getErrors());
      warnings.push(...recordsResult.getWarnings());
    }

    // Post-processing: expand wildcards in DiagramView visibleEntities
    // At this point all tables, tableGroups, notes are fully interpreted
    expandDiagramViewWildcards(this.env);

    return new Report(convertEnvToDb(this.env), errors, warnings);
  }
}
