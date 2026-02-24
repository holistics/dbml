import { capitalize, get } from 'lodash-es';
import Schema, { NormalizedSchemaIdMap, RawSchema } from './schema';
import Ref, { NormalizedRefIdMap } from './ref';
import Enum, { NormalizedEnumIdMap } from './enum';
import TableGroup, { NormalizedTableGroupIdMap } from './tableGroup';
import Table, { NormalizedTableIdMap } from './table';
import StickyNote, { NormalizedNoteIdMap } from './stickyNote';
import Element, { RawNote, Token } from './element';
import {
  DEFAULT_SCHEMA_NAME, TABLE, TABLE_GROUP, ENUM, REF, NOTE,
} from './config';
import DbState from './dbState';
import TablePartial, { NormalizedTablePartialIdMap } from './tablePartial';
import { NormalizedEndpointIdMap } from './endpoint';
import { NormalizedEnumValueIdMap } from './enumValue';
import { NormalizedFieldIdMap } from './field';
import { NormalizedIndexColumnIdMap } from './indexColumn';
import { NormalizedIndexIdMap } from './indexes';
import { NormalizedCheckIdMap } from './check';

export interface Project {
  note: RawNote;
  database_type: string;
  name: string;
}

export type RecordValueType = 'string' | 'bool' | 'integer' | 'real' | 'date' | 'time' | 'datetime' | string;

export interface RecordValue {
  value: any;
  type: RecordValueType;
}

export interface RawTableRecord {
  schemaName: string | undefined;
  tableName: string;
  columns: string[];
  values: {
    value: any;
    type: RecordValueType;
  }[][];
}

export interface TableRecord extends RawTableRecord {
  id: number;
}

export type NormalizedRecord = TableRecord;

export interface NormalizedRecordIdMap {
  [_id: number]: NormalizedRecord;
}

export interface RawDatabase {
  schemas: RawSchema[];
  tables: any[];
  notes: any[];
  enums: any[];
  refs: any[];
  tableGroups: any[];
  project: Project;
  records: RawTableRecord[];
  tablePartials: any[];
}

export interface NormalizedDatabase {
  id: number;
  hasDefaultSchema: boolean;
  note: string | null;
  databaseType: string;
  name: string;
  schemaIds: number[];
  noteIds: number[];
}

export interface NormalizedDatabaseIdMap {
  [_id: number]: NormalizedDatabase;
}

export interface NormalizedModel {
  database: NormalizedDatabaseIdMap;
  schemas: NormalizedSchemaIdMap;
  endpoints: NormalizedEndpointIdMap;
  refs: NormalizedRefIdMap;
  fields: NormalizedFieldIdMap;
  tables: NormalizedTableIdMap;
  tableGroups: NormalizedTableGroupIdMap;
  enums: NormalizedEnumIdMap;
  enumValues: NormalizedEnumValueIdMap;
  indexes: NormalizedIndexIdMap;
  indexColumns: NormalizedIndexColumnIdMap;
  notes: NormalizedNoteIdMap;
  checks: NormalizedCheckIdMap;
  tablePartials: NormalizedTablePartialIdMap;
  records: NormalizedRecordIdMap;
}

class Database extends Element {
  dbState: DbState;
  hasDefaultSchema: boolean;
  schemas: Schema[];
  notes: StickyNote[];
  note: string;
  noteToken: Token;
  databaseType: string;
  name: string;
  records: TableRecord[];
  tablePartials: TablePartial[];
  aliases: any[];
  injectedRawRefs: any[];

  constructor ({
    schemas = [],
    tables = [],
    notes = [],
    enums = [],
    refs = [],
    tableGroups = [],
    project = {} as Project,
    aliases = [],
    records = [],
    tablePartials = [],
  }: Partial<RawDatabase> & { aliases?: any[] } = {}) {
    super(undefined as unknown as Token);
    this.dbState = new DbState();
    this.generateId();
    this.hasDefaultSchema = false;
    this.schemas = [];
    this.notes = [];
    this.note = (project.note ? get(project, 'note.value', project.note) : null) as string;
    this.noteToken = (project.note ? get(project, 'note.token', (project as any).noteToken) : null) as Token;
    this.databaseType = project.database_type;
    this.name = project.name;
    this.token = (project as any).token;
    this.aliases = aliases;
    this.records = [];
    this.tablePartials = [];

    // The global array containing references with 1 endpoint being a field injected from a partial to a table
    // These refs are add to this array when resolving partials in tables (`Table.processPartials()`)
    this.injectedRawRefs = [];

    // The process order is important. Do not change !
    this.processNotes(notes);
    this.processRecords(records);
    this.processTablePartials(tablePartials);
    this.processSchemas(schemas);
    this.processSchemaElements(enums, ENUM);
    this.processSchemaElements(tables, TABLE);
    this.processSchemaElements(notes, NOTE);
    this.processSchemaElements(refs, REF);
    this.processSchemaElements(tableGroups, TABLE_GROUP);

    this.injectedRawRefs.forEach((rawRef) => {
      const schema = this.findOrCreateSchema(DEFAULT_SCHEMA_NAME);
      const ref = new Ref({ ...rawRef, schema });
      if (schema.refs.some((r) => r.equals(ref))) return;
      schema.pushRef(ref);
    });
  }

  generateId (): void {
    this.id = this.dbState.generateId('dbId');
  }

  processNotes (rawNotes: any[]): void {
    rawNotes.forEach((note) => {
      this.pushNote(new StickyNote({ ...note, database: this }));
    });
  }

  pushNote (note: StickyNote): void {
    this.checkNote(note);
    this.notes.push(note);
  }

  checkNote (note: StickyNote): void {
    if (this.notes.some((n) => n.name === note.name)) {
      note.error(`Notes ${note.name} existed`);
    }
  }

  processRecords (rawRecords: RawTableRecord[]): void {
    rawRecords.forEach(({
      schemaName, tableName, columns, values,
    }) => {
      this.records.push({
        id: this.dbState.generateId('recordId'),
        schemaName,
        tableName,
        columns,
        values,
      });
    });
  }

  processTablePartials (rawTablePartials: any[]): TablePartial[] {
    rawTablePartials.forEach((rawTablePartial) => {
      this.tablePartials.push(new TablePartial({ ...rawTablePartial, dbState: this.dbState }));
    });
    return this.tablePartials;
  }

  processSchemas (rawSchemas: RawSchema[]): void {
    rawSchemas.forEach((schema) => {
      this.pushSchema(new Schema({ ...schema, database: this }));
    });
  }

  pushSchema (schema: Schema): void {
    this.checkSchema(schema);
    this.schemas.push(schema);
  }

  checkSchema (schema: Schema): void {
    if (this.schemas.some((s) => s.name === schema.name)) {
      schema.error(`Schemas ${schema.name} existed`);
    }
  }

  processSchemaElements (
    elements: any[],
    elementType: any,
  ): void {
    let schema: Schema;

    elements.forEach((element) => {
      if (element.schemaName) {
        schema = this.findOrCreateSchema(element.schemaName);
        if (element.schemaName === DEFAULT_SCHEMA_NAME) {
          // this.hasDefaultSchema = true;
        }
      } else {
        schema = this.findOrCreateSchema(DEFAULT_SCHEMA_NAME);
      }

      switch (elementType) {
        case TABLE:
          schema.pushTable(new Table({ ...element, schema }));
          break;

        case ENUM:
          schema.pushEnum(new Enum({ ...element, schema }));
          break;

        case TABLE_GROUP:
          schema.pushTableGroup(new TableGroup({ ...element, schema }));
          break;

        case REF:
          schema.pushRef(new Ref({ ...element, schema }));
          break;

        default:
          break;
      }
    });
  }

  findOrCreateSchema (schemaName: string): Schema {
    let schema = this.schemas.find((s) => s.name === schemaName || s.alias === schemaName);
    // create new schema if schema not found
    if (!schema) {
      schema = new Schema({
        name: schemaName,
        note: {
          value: schemaName === DEFAULT_SCHEMA_NAME ? `Default ${capitalize(DEFAULT_SCHEMA_NAME)} Schema` : null,
        } as RawNote,
        database: this,
      });

      this.pushSchema(schema);
    }

    return schema;
  }

  findTableAlias (alias: string): Table | null | undefined {
    const sym = this.aliases.find((a) => a.name === alias);
    if (!sym || sym.kind !== 'table') return null;

    const schemaName = sym.value.schemaName || DEFAULT_SCHEMA_NAME;
    const schema = this.schemas.find((s) => s.name === schemaName);
    if (!schema) return null;

    const { tableName } = sym.value;
    const table = schema.tables.find((t) => t.name === tableName);
    return table;
  }

  findTable (
    schemaName: any,
    tableName?: any,
  ): Table | undefined {
    let table = null;
    if (!schemaName) {
      table = this.findTableAlias(tableName);
      if (table) return table;
    }

    const schema = this.findOrCreateSchema(schemaName || DEFAULT_SCHEMA_NAME);
    if (!schema) {
      this.error(`Schema ${schemaName || DEFAULT_SCHEMA_NAME} don't exist`);
    }
    return schema.findTable(tableName);
  }

  findEnum (
    schemaName: string,
    name: string,
  ): Enum | null | undefined {
    const schema = this.schemas.find((s) => s.name === schemaName || s.alias === schemaName);
    if (!schema) return null;
    const _enum = schema.enums.find((e) => e.name === name);
    return _enum;
  }

  findTablePartial (name: string): TablePartial | undefined {
    return this.tablePartials.find((tp) => tp.name === name);
  }

  export (): ReturnType<Database['exportChild']> {
    return {
      ...this.exportChild(),
    };
  }

  shallowExport (): { hasDefaultSchema: boolean; note: string; databaseType: string; name: string } {
    return {
      hasDefaultSchema: this.hasDefaultSchema,
      note: this.note,
      databaseType: this.databaseType,
      name: this.name,
    };
  }

  exportChild (): { schemas: ReturnType<Schema['export']>[]; notes: ReturnType<StickyNote['export']>[]; records: TableRecord[] } {
    return {
      schemas: this.schemas.map((s) => s.export()),
      notes: this.notes.map((n) => n.export()),
      records: this.records.map((r) => ({ ...r })),
    };
  }

  exportChildIds (): { schemaIds: number[]; noteIds: number[] } {
    return {
      schemaIds: this.schemas.map((s) => s.id),
      noteIds: this.notes.map((n) => n.id),
    };
  }

  normalize (): NormalizedModel {
    const normalizedModel: NormalizedModel = {
      database: {
        [this.id]: {
          id: this.id,
          ...this.shallowExport(),
          ...this.exportChildIds(),
        },
      },
      schemas: {},
      notes: {},
      refs: {},
      enums: {},
      tableGroups: {},
      tables: {},
      endpoints: {},
      enumValues: {},
      indexes: {},
      indexColumns: {},
      checks: {},
      fields: {},
      records: {},
      tablePartials: {},
    };

    this.schemas.forEach((schema) => schema.normalize(normalizedModel));
    this.notes.forEach((note) => note.normalize(normalizedModel));
    this.records.forEach((record) => { normalizedModel.records[record.id] = { ...record }; });
    this.tablePartials.forEach((tablePartial) => tablePartial.normalize(normalizedModel));
    return normalizedModel;
  }
}

export default Database;
