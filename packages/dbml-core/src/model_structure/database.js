import { capitalize, get } from 'lodash-es';
import {
  DEFAULT_SCHEMA_NAME, ENUM, NOTE, REF, TABLE, TABLE_GROUP,
} from './config';
import DbState from './dbState';
import Element from './element';
import Enum from './enum';
import Metadata from './metadata';
import Ref from './ref';
import Schema from './schema';
import StickyNote from './stickyNote';
import Table from './table';
import TableGroup from './tableGroup';
import TablePartial from './tablePartial';

class Database extends Element {
  /**
    * @param {import('../../types/model_structure/database').RawDatabase} param0
    */
  constructor ({
    schemas = [],
    tables = [],
    notes = [],
    enums = [],
    refs = [],
    tableGroups = [],
    project = {},
    aliases = [],
    records = [],
    tablePartials = [],
    diagramViews = [],
    metadataElements = [],
  }) {
    super();
    this.dbState = new DbState();
    this.generateId();
    this.hasDefaultSchema = false;
    /** @type {import('../../types/model_structure/schema').default[]} */
    this.schemas = [];
    this.notes = [];
    /** @type {import('../../types/model_structure/metadata').default[]} */
    this.metadataElements = [];
    this.note = project.note ? get(project, 'note.value', project.note) : null;
    this.noteToken = project.note ? get(project, 'note.token', project.noteToken) : null;
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
      if (schema.refs.some((r) => r.equals(ref))) return;
      schema.pushRef(ref);
    });

    // Metadata elements must be processed last: their targets (tables, columns,
    // schemas, table groups, notes) must already exist to be resolved.
    this.processMetadataElements(metadataElements);
  }

  generateId () {
    this.id = this.dbState.generateId('dbId');
  }

  processNotes (rawNotes) {
    rawNotes.forEach((note) => {
      this.pushNote(new StickyNote({ ...note, database: this }));
    });
  }

  processRecords (rawRecords) {
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

  processTablePartials (rawTablePartials) {
    rawTablePartials.forEach((rawTablePartial) => {
      this.tablePartials.push(new TablePartial({ ...rawTablePartial, dbState: this.dbState }));
    });
  }

  pushNote (note) {
    this.checkNote(note);
    this.notes.push(note);
  }

  checkNote (note) {
    if (this.notes.some((n) => n.name === note.name)) {
      note.error(`Notes ${note.name} existed`);
    }
  }

  processSchemas (rawSchemas) {
    rawSchemas.forEach((schema) => {
      this.pushSchema(new Schema({ ...schema, database: this }));
    });
  }

  pushSchema (schema) {
    this.checkSchema(schema);
    this.schemas.push(schema);
  }

  checkSchema (schema) {
    if (this.schemas.some((s) => s.name === schema.name)) {
      schema.error(`Schemas ${schema.name} existed`);
    }
  }

  processSchemaElements (elements, elementType) {
    let schema;

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

  /**
   * Resolve each raw Metadata element to its target element and wire up the
   * two-way link (Metadata.target -> element, element._metadata -> Metadata).
   * @param {any[]} rawMetadataElements
   */
  processMetadataElements (rawMetadataElements) {
    rawMetadataElements.forEach((rawMetadata) => {
      const meta = new Metadata({ ...rawMetadata, database: this });
      const target = this.resolveMetadataTarget(meta);

      if (!target) {
        const name = (meta.targetName || []).join('.');
        meta.error(`Metadata ${meta.targetKind} target "${name}" not found`);
      }

      meta.target = target;
      target.pushMetadata(meta);
      this.metadataElements.push(meta);
    });
  }

  /**
   * Resolve a Metadata element's target element from its kind and name parts.
   * Name parts are in dotted order with an optional leading schema:
   *   table:      [schema?, table]
   *   column:     [schema?, table, column]
   *   schema:     [schema]
   *   tablegroup: [schema?, tableGroup]
   *   note:       [schema?, note]
   * @param {import('../../types/model_structure/metadata').default} meta
   * @returns {import('../../types/model_structure/element').default | null}
   */
  resolveMetadataTarget (meta) {
    const parts = [...(meta.targetName || [])];
    if (parts.length === 0) return null;

    switch (meta.targetKind) {
      case 'table': {
        const tableName = parts[parts.length - 1];
        const schemaName = parts.length > 1 ? parts[parts.length - 2] : null;
        return this.findTable(schemaName, tableName) || null;
      }

      case 'column': {
        const columnName = parts[parts.length - 1];
        const tableName = parts[parts.length - 2];
        const schemaName = parts.length > 2 ? parts[parts.length - 3] : null;
        const table = this.findTable(schemaName, tableName);
        if (!table) return null;
        return table.fields.find((f) => f.name === columnName) || null;
      }

      case 'schema': {
        const schemaName = parts[parts.length - 1];
        return this.schemas.find((s) => s.name === schemaName || s.alias === schemaName) || null;
      }

      case 'tablegroup': {
        const groupName = parts[parts.length - 1];
        const schemaName = parts.length > 1 ? parts[parts.length - 2] : null;
        const schema = this.schemas.find((s) => s.name === (schemaName || DEFAULT_SCHEMA_NAME) || s.alias === schemaName);
        if (!schema) return null;
        return schema.tableGroups.find((tg) => tg.name === groupName) || null;
      }

      case 'note': {
        const noteName = parts[parts.length - 1];
        return this.notes.find((n) => n.name === noteName) || null;
      }

      default:
        return null;
    }
  }

  linkRecordsToTables () {
    // Build a map of [schemaName][tableName] -> table for O(1) lookup
    const tableMap = {};
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

  findOrCreateSchema (schemaName) {
    let schema = this.schemas.find((s) => s.name === schemaName || s.alias === schemaName);
    // create new schema if schema not found
    if (!schema) {
      schema = new Schema({
        name: schemaName,
        note: {
          value: schemaName === DEFAULT_SCHEMA_NAME ? `Default ${capitalize(DEFAULT_SCHEMA_NAME)} Schema` : null,
        },
        database: this,
      });

      this.pushSchema(schema);
    }

    return schema;
  }

  findTableAlias (alias) {
    const sym = this.aliases.find((a) => a.name === alias);
    if (!sym || sym.kind !== 'table') return null;

    const schemaName = sym.value.schemaName || DEFAULT_SCHEMA_NAME;
    const schema = this.schemas.find((s) => s.name === schemaName);
    if (!schema) return null;

    const { tableName } = sym.value;
    const table = schema.tables.find((t) => t.name === tableName);
    return table;
  }

  findTable (schemaName, tableName) {
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

  findEnum (schemaName, name) {
    const schema = this.schemas.find((s) => s.name === schemaName || s.alias === schemaName);
    if (!schema) return null;
    const _enum = schema.enums.find((e) => e.name === name);
    return _enum;
  }

  findTablePartial (name) {
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
      metadataElements: this.metadataElements.map((m) => m.export()),
    };
  }

  exportChildIds () {
    return {
      schemaIds: this.schemas.map((s) => s.id),
      noteIds: this.notes.map((n) => n.id),
      metadataIds: this.metadataElements.map((m) => m.id),
    };
  }

  normalize () {
    const normalizedModel = {
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
      metadata: {},
    };

    this.schemas.forEach((schema) => schema.normalize(normalizedModel));
    this.notes.forEach((note) => note.normalize(normalizedModel));
    this.records.forEach((record) => { normalizedModel.records[record.id] = { ...record }; });
    this.tablePartials.forEach((tablePartial) => tablePartial.normalize(normalizedModel));
    this.metadataElements.forEach((metadata) => metadata.normalize(normalizedModel));
    return normalizedModel;
  }
}

export default Database;
