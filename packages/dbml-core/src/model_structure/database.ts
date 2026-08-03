import { capitalize, get } from 'lodash-es';
import { parseCardinality, makeCardinalityRequired } from '@dbml/parse';
import {
  DEFAULT_SCHEMA_NAME, ENUM, NOTE, REF, TABLE, TABLE_GROUP,
} from './config';
import DbState from './dbState';
import Element from './element';
import Enum from './enum';
import Ref from './ref';
import Schema from './schema';
import StickyNote from './stickyNote';
import Table from './table';
import TableGroup from './tableGroup';
import TablePartial from './tablePartial';
import type {
  RawDatabase, TableRecord, RawTableRecord, NormalizedModel,
} from '../../types/model_structure/database';
import type { Token } from '../../types/model_structure/element';
import type { DiagramView } from '@dbml/parse';

class Database extends Element {
  dbState: DbState;
  hasDefaultSchema: boolean;
  schemas: Schema[];
  notes: StickyNote[];
  note: string | null;
  noteToken: Token | null;
  databaseType: string;
  name: string;
  records: TableRecord[];
  tablePartials: TablePartial[];
  diagramViews: DiagramView[];
  aliases: any[];
  injectedRawRefs: any[];
  id!: number;

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
    diagramViews = [],
  }: Partial<RawDatabase> & { aliases?: any[] } = {} as any) {
    super();
    this.dbState = new DbState();
    this.generateId();
    this.hasDefaultSchema = false;
    this.schemas = [];
    this.notes = [];
    this.note = project.note ? get(project, 'note.value', typeof project.note === 'string' ? project.note : null) : null;
    this.noteToken = project.note ? get(project, 'note.token', (project as any).noteToken) : null;
    this.databaseType = project.database_type;
    this.name = project.name;
    this.token = project.token;
    this.aliases = aliases;
    this.records = [];
    this.tablePartials = [];
    this.diagramViews = diagramViews;

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
    this.linkRecordsToTables();
    this.processSchemaElements(notes, NOTE);
    this.processSchemaElements(refs, REF);
    this.processSchemaElements(tableGroups, TABLE_GROUP);

    this.injectedRawRefs.forEach((rawRef) => {
      const schema = this.findOrCreateSchema(DEFAULT_SCHEMA_NAME);
      const ref = new Ref({ ...rawRef, schema });
      if (schema.refs.some((r) => r.equals(ref as any))) return;
      schema.pushRef(ref);
    });
  }

  private generateId (): void {
    this.id = this.dbState.generateId('dbId');
  }

  private processNotes (rawNotes: any[]): void {
    rawNotes.forEach((note) => {
      this.pushNote(new StickyNote({ ...note, database: this }));
    });
  }

  private processRecords (rawRecords: RawTableRecord[]): void {
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

  private processTablePartials (rawTablePartials: any[]): void {
    rawTablePartials.forEach((rawTablePartial) => {
      this.tablePartials.push(new TablePartial({ ...rawTablePartial, dbState: this.dbState }));
    });
  }

  private pushNote (note: StickyNote): void {
    this.checkNote(note);
    this.notes.push(note);
  }

  private checkNote (note: StickyNote): void {
    if (this.notes.some((n) => n.name === note.name)) {
      note.error(`Notes ${note.name} existed`);
    }
  }

  private processSchemas (rawSchemas: any[]): void {
    rawSchemas.forEach((schema) => {
      this.pushSchema(new Schema({ ...schema, database: this }));
    });
  }

  private pushSchema (schema: Schema): void {
    this.checkSchema(schema);
    this.schemas.push(schema);
  }

  private checkSchema (schema: Schema): void {
    if (this.schemas.some((s) => s.name === schema.name)) {
      schema.error(`Schemas ${schema.name} existed`);
    }
  }

  private processSchemaElements (elements: any[], elementType: string): void {
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

  private linkRecordsToTables (): void {
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
          value: schemaName === DEFAULT_SCHEMA_NAME ? `Default ${capitalize(DEFAULT_SCHEMA_NAME)} Schema` : null,
        } as any,
        database: this as any,
      });

      this.pushSchema(schema);
    }

    return schema;
  }

  findTableAlias (alias: string): Table | null {
    const sym = this.aliases.find((a) => a.name === alias);
    if (!sym || sym.kind !== 'table') return null;

    const schemaName = sym.value.schemaName || DEFAULT_SCHEMA_NAME;
    const schema = this.schemas.find((s) => s.name === schemaName);
    if (!schema) return null;

    const { tableName } = sym.value;
    const table = schema.tables.find((t) => t.name === tableName);
    return table || null;
  }

  findTable (schemaName: string | null, tableName: string): Table | undefined {
    let table: Table | null | undefined = null;
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

  // SQL importers just import everything as optional
  // So we need to adjust the cardinality of those if they are in actuality required
  // We only handle one-to-many/many-to-one/one-to-one here
  adjustCardinalitiesFromColumns (): void {
    this.schemas.forEach((schema) => {
      schema.refs.forEach((ref) => {
        const manyEndpoint = ref.endpoints.find((e: any) => parseCardinality(e.relation).max === '*');
        const oneEndpoint = ref.endpoints.find((e: any) => parseCardinality(e.relation).max === 1);

        // Many-to-many, no need to adjust
        if (!oneEndpoint) return;

        let sourceFkEndpoint: any;
        let targetFkEndpoint: any;

        // one-to-many/many-to-one
        if (manyEndpoint) {
          sourceFkEndpoint = manyEndpoint;
          targetFkEndpoint = oneEndpoint;
        } else {
          // one-to-one: right endpoint is the FK source, left is the REFERENCES target
          // (matches SQL exporter convention)
          sourceFkEndpoint = ref.endpoints[1];
          targetFkEndpoint = ref.endpoints[0];
        }

        if (!sourceFkEndpoint || !targetFkEndpoint) return; // not simple many-to-one or one-to-many

        const isSourceNotNull = sourceFkEndpoint.fields.every((f: any) => f.not_null || f.pk || f.increment);

        if (isSourceNotNull) {
          targetFkEndpoint.relation = makeCardinalityRequired(targetFkEndpoint.relation);
        }
      });
    });
  }

  export () {
    return {
      ...this.exportChild(),
    };
  }

  private shallowExport () {
    return {
      hasDefaultSchema: this.hasDefaultSchema,
      note: this.note,
      databaseType: this.databaseType,
      name: this.name,
    };
  }

  private exportChild () {
    return {
      schemas: this.schemas.map((s) => s.export()),
      notes: this.notes.map((n) => n.export()),
      records: this.records.map((r) => ({ ...r })),
    };
  }

  private exportChildIds () {
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
    } as any;

    this.schemas.forEach((schema) => schema.normalize(normalizedModel));
    this.notes.forEach((note) => note.normalize(normalizedModel));
    this.records.forEach((record) => { (normalizedModel.records as any)[record.id] = { ...record }; });
    this.tablePartials.forEach((tablePartial) => tablePartial.normalize(normalizedModel));
    return normalizedModel;
  }
}

export default Database;
