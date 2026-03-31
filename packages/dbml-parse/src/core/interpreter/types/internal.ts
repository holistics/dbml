import { ElementDeclarationNode, FunctionApplicationNode, SyntaxNode } from '@/core/parser/nodes';
import { CompileError } from '@/core/errors';
import { Filepath, FilepathId } from '@/compiler/projectLayout';
import { ImportKind } from '@/core/analyzer/validator/validators/use';

export { ImportKind };

import type {
  Alias, Database, Enum, Note, Ref, Table, TableGroup,
  TablePartial, TableRecord, TokenPosition, RecordValueType,
  Project,
} from './raw';

// Internal types

export interface ElementInterpreter {
  interpret(): CompileError[];
}

export interface TableRecordRow {
  values: Record<string, {
    value: any;
    type: RecordValueType;
    node?: SyntaxNode;
  }>;
  node: FunctionApplicationNode;
  columnNodes: Record<string, SyntaxNode>;
}

export interface TableRecordsData {
  table: Table;
  rows: TableRecordRow[];
}

export interface Import {
  name: string;
  schemaName: string | null;
  alias?: string;
  sourceFilepath: string;
  reexport: boolean;
}

export interface Imports {
  tables: Import[];
  enums: Import[];
  tableGroups: Import[];
  tablePartials: Import[];
  notes: Import[];
}

export interface ElementRef {
  filepath: Filepath;
  name: string;
  aliasedName?: string;
  schemaName: string | null;
}

export interface FileManifest {
  tables: ElementRef[];
  enums: ElementRef[];
  tableGroups: ElementRef[];
  tablePartials: ElementRef[];
  notes: ElementRef[];
}

export interface MasterDatabase {
  files: Record<FilepathId, FileManifest>;
  items: Database;
}

// Interpreter environment

export class InterpreterDatabase {
  // Maps from the AST elements to their interpreted result
  tables = new Map<ElementDeclarationNode, Table>();
  notes = new Map<ElementDeclarationNode, Note>();
  ref = new Map<ElementDeclarationNode, Ref>();
  enums = new Map<ElementDeclarationNode, Enum>();
  tableGroups = new Map<ElementDeclarationNode, TableGroup>();
  tablePartials = new Map<ElementDeclarationNode, TablePartial>();
  project = new Map<ElementDeclarationNode, Project>();
  records = new Map<Table, TableRecordRow[]>();
  aliases: Alias[] = [];

  // Cached states
  tableOwnerGroup: {
    [tableId: string]: ElementDeclarationNode;
  } = {}; // A map from a table id to its owning group

  recordsElements: ElementDeclarationNode[] = []; // A list of records Elements

  cachedMergedTables = new Map<Table, Table>(); // A map from the interpreted Table to the Table merged with its Partial Injection

  refIds: {
    [refId: string]: ElementDeclarationNode;
  } = {}; // A map from ref id to its declaration

  toMasterDatabase (): MasterDatabase {
    const tables = Array.from(this.tables.values()).map(InterpreterDatabase.processColumn);
    const notes = Array.from(this.notes.values());
    const refs = Array.from(this.ref.values());
    const enums = Array.from(this.enums.values());
    const tableGroups = Array.from(this.tableGroups.values());
    const tablePartials = Array.from(this.tablePartials.values()).map(InterpreterDatabase.processColumn);
    const projects = Array.from(this.project.values());

    const records: TableRecord[] = [];
    for (const [table, block] of this.records) {
      if (!block.length) continue;
      const columns = Object.keys(block[0].columnNodes);
      records.push({
        schemaName: table.schemaName || undefined,
        tableName: table.name,
        columns,
        values: block.map((r) => columns.map((col) => {
          const val = r.values[col];
          return val ? { value: val.value, type: val.type } : { value: null, type: 'expression' };
        })),
      });
    }

    const objects: Database = {
      schemas: [],
      tables,
      notes,
      refs,
      enums,
      tableGroups,
      aliases: this.aliases,
      project: projects[0] ?? {},
      tablePartials,
      records,
    };

    const files: Record<string, FileManifest> = {};

    const addElementRefs = <T extends {
      token: TokenPosition;
      name: string;
      schemaName?: string | null;
    }>(
      items: T[],
      importKind: ImportKind,
    ) => {
      items.forEach((item, index) => {
        const filepath = item.token.filepath;

        const filepathId = filepath.intern();
        if (!files[filepathId]) files[filepathId] = {
          tables: [],
          enums: [],
          tableGroups: [],
          tablePartials: [],
          notes: [],
        };

        const file = files[filepathId];
        const elementRef = {
          index,
          filepath: filepath,
          name: item.name,
          schemaName: item.schemaName ?? null,
        };

        switch (importKind) {
          case ImportKind.Table:
            file.tables.push(elementRef);
            break;
          case ImportKind.TableGroup:
            break;
          case ImportKind.Enum:
            break;
          case ImportKind.TablePartial:
            break;
          case ImportKind.Note:
            break;
          default: {
            const _: never = importKind;
          }
        }
      });
    };

    addElementRefs(tables, ImportKind.Table);
    addElementRefs(enums, ImportKind.Enum);
    addElementRefs(tableGroups, ImportKind.TableGroup);
    addElementRefs(tablePartials, ImportKind.TablePartial);
    addElementRefs(notes, ImportKind.Note);

    return { files, items: objects };
  }

  private static processColumn<T extends Table | TablePartial> (table: T): T {
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
}
