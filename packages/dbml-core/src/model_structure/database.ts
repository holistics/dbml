import { capitalize, get } from 'lodash-es';
import Schema from './schema';
import Ref from './ref';
import Enum from './enum';
import TableGroup from './tableGroup';
import Table from './table';
import StickyNote from './stickyNote';
import Element, { Token, RawNote } from './element';
import {
  DEFAULT_SCHEMA_NAME, TABLE, TABLE_GROUP, ENUM, REF,
} from './config';
import DbState from './dbState';
import TablePartial from './tablePartial';

export interface TableRecord {
  id: number;
  schemaName?: string;
  tableName: string;
  columns: string[];
  token: Token;
  values: any[][];
  tableId?: number;
}

export interface RawTableRecord {
  schemaName: string | undefined;
  tableName: string;
  columns: string[];
  token: Token;
  values: any[][];
}

export interface Project {
  note: RawNote;
  database_type: string;
  name: string;
  token?: Token;
  noteToken?: Token;
}

export interface RawDatabase {
  schemas?: any[];
  tables?: any[];
  notes?: any[];
  enums?: any[];
  refs?: any[];
  tableGroups?: any[];
  project?: any;
  aliases?: any[];
  records?: RawTableRecord[];
  tablePartials?: any[];
}

export interface NormalizedModel {
  database: Record<number, any>;
  schemas: Record<number, any>;
  endpoints: Record<number, any>;
  refs: Record<number, any>;
  fields: Record<number, any>;
  tables: Record<number, any>;
  tableGroups: Record<number, any>;
  enums: Record<number, any>;
  enumValues: Record<number, any>;
  indexes: Record<number, any>;
  indexColumns: Record<number, any>;
  notes: Record<number, any>;
  checks: Record<number, any>;
  tablePartials: Record<number, any>;
  records: Record<number, any>;
}

class Database extends Element {
  dbState: DbState;
  hasDefaultSchema: boolean;
  schemas: Schema[];
  notes: StickyNote[];
  note: string | null;
  noteToken: Token | null;
  databaseType: string;
  name: string;
  aliases: any[];
  records: TableRecord[];
  tablePartials: TablePartial[];
  injectedRawRefs: any[];

  constructor ({
    schemas = [],
    tables = [],
    notes = [],
    enums = [],
    refs = [],
    tableGroups = [],
    project = {} as any,
    aliases = [],
    records = [],
    tablePartials = [],
  }: RawDatabase) {
    super(undefined as any);
    this.dbState = new DbState();
    this.generateId();
    this.hasDefaultSchema = false;
    this.schemas = [];
    this.notes = [];
    this.note = project.note ? get(project, 'note.value', project.note) : null;
    this.noteToken = project.note ? get(project, 'note.token', project.noteToken) : null;
    this.databaseType = project.database_type;
    this.name = project.name;
    this.token = project.token;
    this.aliases = aliases;
    this.records = [];
    this.tablePartials = [];

    // The global array containing references with 1 endpoint being a field injected from a partial to a table
    // These refs are add to this array when resolving partials in tables (`Table.processPartials()`)
    this.injectedRawRefs = [];

    // The process order is important. Do not change !
    this.processNotes(notes);
    this.processRecords(records as RawTableRecord[]);
    this.processTablePartials(tablePartials);
    this.processSchemas(schemas);
    this.processSchemaElements(enums, ENUM);
    this.processSchemaElements(tables, TABLE);
    this.linkRecordsToTables();
    this.processSchemaElements(notes, 'note');
    this.processSchemaElements(refs, REF);
    this.processSchemaElements(tableGroups, TABLE_GROUP);

    this.injectedRawRefs.forEach((rawRef) => {
      const schema = this.findOrCreateSchema(DEFAULT_SCHEMA_NAME);
      const ref = new Ref({ ...rawRef, schema });
      if (schema.refs.some((r) => r.equals(ref))) return;
      schema.pushRef(ref);
    });
  }

  generateId () {
    this.id = this.dbState.generateId('dbId');
  }

  processNotes (rawNotes: any[]) {
    rawNotes.forEach((note) => {
      this.pushNote(new StickyNote({ ...note, database: this }));
    });
  }

  processRecords (rawRecords: RawTableRecord[]) {
    rawRecords.forEach(({
      schemaName, tableName, columns, values, token,
    }) => {
      this.records.push({
        id: this.dbState.generateId('recordId'),
        schemaName,
        tableName,
        columns,
        values,
        token,
      });
    });
  }

  processTablePartials (rawTablePartials: any[]) {
    rawTablePartials.forEach((rawTablePartial) => {
      this.tablePartials.push(new TablePartial({ ...rawTablePartial, dbState: this.dbState }));
    });
  }

  pushNote (note: StickyNote) {
    this.checkNote(note);
    this.notes.push(note);
  }

  checkNote (note: StickyNote) {
    if (this.notes.some((n) => n.name === note.name)) {
      note.error(`Notes ${note.name} existed`);
    }
  }

  processSchemas (rawSchemas: any[]) {
    rawSchemas.forEach((schema) => {
      this.pushSchema(new Schema({ ...schema, database: this }));
    });
  }

  pushSchema (schema: Schema) {
    this.checkSchema(schema);
    this.schemas.push(schema);
  }

  checkSchema (schema: Schema) {
    if (this.schemas.some((s) => s.name === schema.name)) {
      schema.error(`Schemas ${schema.name} existed`);
    }
  }

  processSchemaElements (elements: any[], elementType: string) {
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

  linkRecordsToTables () {
    // Build a map of [schemaName][tableName] -> table for O(1) lookup
    const tableMap: Record<string, Record<string, Table>> = {};
    this.schemas.forEach((schema) => {
      tableMap[schema.name] = {};
      schema.tables.forEach((table) => {
        tableMap[schema.name][table.name] = table;
      });
    });

    // Link records to tables using the map
    this.records.forEach((record) => {
      // Fallback to 'public' if schemaName is null, undefined
      const schemaName = record.schemaName ?? DEFAULT_SCHEMA_NAME;
      const table = tableMap[schemaName]?.[record.tableName];
      if (!table) return;

      record.tableId = table.id;
      table.records.push(record);
    });
  }

  findOrCreateSchema (schemaName: string): Schema {
    let schema = this.schemas.find((s) => s.name === schemaName || s.alias === schemaName);
    // create new schema if schema not found
    if (!schema) {
      schema = new Schema({
        name: schemaName,
        note: {
          value: schemaName === DEFAULT_SCHEMA_NAME ? `Default ${capitalize(DEFAULT_SCHEMA_NAME)} Schema` : (null as any),
          token: undefined as any,
        },
        database: this,
      });

      this.pushSchema(schema);
    }

    return schema;
  }

  findTableAlias (alias: string): Table | undefined {
    const sym = this.aliases.find((a) => a.name === alias);
    if (!sym || sym.kind !== 'table') return undefined;

    const schemaName = sym.value.schemaName || DEFAULT_SCHEMA_NAME;
    const schema = this.schemas.find((s) => s.name === schemaName);
    if (!schema) return undefined;

    const { tableName } = sym.value;
    const table = schema.tables.find((t) => t.name === tableName);
    return table;
  }

  findTable (schemaName: string | null, tableName: string): Table | undefined {
    let table: Table | undefined = undefined;
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

  findEnum (schemaName: string, name: string): Enum | undefined {
    const schema = this.schemas.find((s) => s.name === schemaName || s.alias === schemaName);
    if (!schema) return undefined;
    const _enum = schema.enums.find((e) => e.name === name);
    return _enum;
  }

  findTablePartial (name: string): TablePartial | undefined {
    return this.tablePartials.find((tp) => tp.name === name);
  }

  export () {
    return {
      ...this.exportChild(),
    };
  }

  shallowExport () {
    return {
      hasDefaultSchema: this.hasDefaultSchema,
      note: this.note,
      databaseType: this.databaseType,
      name: this.name,
    };
  }

  exportChild () {
    return {
      schemas: this.schemas.map((s) => s.export()),
      notes: this.notes.map((n) => n.export()),
      records: this.records.map((r) => ({ ...r })),
    };
  }

  exportChildIds () {
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
