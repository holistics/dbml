import { ProgramNode } from '@/core/types/nodes';
import { Database, Table, TablePartial, TableRecord } from '@/core/types/schemaJson';
import { TableInterpreter } from '@/core/interpreter/elementInterpreter/table';
import { StickyNoteInterpreter } from '@/core/interpreter/elementInterpreter/sticky_note';
import { RefInterpreter } from '@/core/interpreter/elementInterpreter/ref';
import { TableGroupInterpreter } from '@/core/interpreter/elementInterpreter/tableGroup';
import { EnumInterpreter } from '@/core/interpreter/elementInterpreter/enum';
import { ProjectInterpreter } from '@/core/interpreter/elementInterpreter/project';
import { TablePartialInterpreter } from '@/core/interpreter/elementInterpreter/tablePartial';
import { DiagramViewInterpreter } from '@/core/interpreter/elementInterpreter/diagramView';
import { RecordsInterpreter } from '@/core/interpreter/records';
import Report from '@/core/types/report';
import { ElementKind } from '@/core/analyzer/types';
import { convertStringToEnum } from '@/core/utils/enum';
import { CompileWarning } from '@/core/types/errors';
import { getTokenPosition } from './utils';
import { InterpreterDatabase } from './types';

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
 * Expand explicit wildcard ([]) for tableGroups in DiagramView visibleEntities
 * to the concrete list of table group names.
 *
 * Only expands when:
 * 1. The user wrote `TableGroups { * }` (tracked via diagramViewWildcards)
 * 2. No other Trinity dim (Tables, Schemas) is explicitly set —
 *    i.e. tableGroups is the only Trinity dim declared.
 *    When other Trinity dims are also declared, [] keeps its "show all" meaning.
 */
function expandDiagramViewWildcards (env: InterpreterDatabase): void {
  for (const view of env.diagramViews.values()) {
    const ve = view.visibleEntities;
    const wildcards = env.diagramViewWildcards.get(view);
    const explicitlySet = env.diagramViewExplicitlySet.get(view);
    if (!wildcards || !explicitlySet) continue;

    if (wildcards.has('tableGroups') && ve.tableGroups && ve.tableGroups.length === 0) {
      const otherTrinitySet = explicitlySet.has('tables') || explicitlySet.has('schemas');
      if (!otherTrinitySet) {
        ve.tableGroups = Array.from(env.tableGroups.values()).map((tg) => ({
          name: tg.name!,
        }));
      }
    }
  }
}

function convertEnvToDb (env: InterpreterDatabase): Database {
  // Convert records Map to array of TableRecord
  const records: TableRecord[] = [];
  for (const [table, { element, rows }] of env.records) {
    if (!rows.length) continue;
    const columns = Object.keys(rows[0].columnNodes);
    records.push({
      schemaName: table.schemaName || undefined,
      tableName: table.name,
      columns,
      token: getTokenPosition(element),
      values: rows.map((r) => {
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
    diagramViews: Array.from(env.diagramViews.values()),
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
      diagramViewWildcards: new Map(),
      diagramViewExplicitlySet: new Map(),
    };
  }

  interpret (): Report<Database> {
    // First pass: interpret all non-records elements
    const errors = this.ast.body.flatMap((element) => {
      switch (convertStringToEnum(ElementKind, element.type?.value ?? '')) {
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
