import _ from 'lodash';
import Schema from './schema';
import Ref from './ref';
import Enum from './enum';
import TableGroup from './tableGroup';
import Table from './table';
import Element from './element';
import { DEFAULT_SCHEMA_NAME, TABLE, TABLE_GROUP, ENUM, REF, TAG } from './config';
import DbState from './dbState';
import Tag from './tag';

class Database extends Element {
  constructor ({ schemas = [], tables = [], enums = [], refs = [], tableGroups = [], tags = [], project = {} }) {
    super();
    this.dbState = new DbState();
    this.generateId();
    this.hasDefaultSchema = false;
    this.schemas = [];
    this.note = project.note;
    this.databaseType = project.database_type;
    this.name = project.name;

    // The process order is important. Do not change !
    this.processSchemas(schemas);
    this.processSchemaElements(tables, TABLE);
    this.processSchemaElements(tags, TAG);
    this.bindTagToTable()
    this.processSchemaElements(refs, REF);
    this.processSchemaElements(enums, ENUM);
    this.processSchemaElements(tableGroups, TABLE_GROUP);
  }

  generateId () {
    this.id = this.dbState.generateId('dbId');
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
    if (this.schemas.some(s => s.name === schema.name)) {
      schema.error(`Schemas ${schema.name} existed`);
    }
  }

  processSchemaElements (elements, elementType) {
    let schema;

    elements.forEach((element) => {
      if (element.schemaName) {
        schema = this.findOrCreateSchema(element.schemaName);
        if (element.schemaName === DEFAULT_SCHEMA_NAME) {
          this.hasDefaultSchema = true;
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

        case TAG:
          schema.pushTag(new Tag({ ...element, schema }));
          break;

        default:
          break;
      }
    });
  }

  bindTagToTable () {
    this.schemas.forEach((schema) => {
      schema.tables.forEach((table) => {
        table.rawTags.forEach((rawTag) => {
          let hasTag = false;
          schema.tags.forEach((tag) => {
            if(tag.name === rawTag.name) {
              hasTag = true;
              table.pushTag(tag);
              tag.pushTable(table);
            }
          });
          // create tag if tag isn't defined before
          if (hasTag === false) {
            const tag = new Tag({ ...rawTag, schema });
            schema.pushTag(tag);
            table.pushTag(tag);
            tag.pushTable(table);
          }
        });
      });
    });
  }

  findOrCreateSchema (schemaName) {
    let schema = this.schemas.find(s => s.name === schemaName || s.alias === schemaName);
    // create new schema if schema not found
    if (!schema) {
      schema = new Schema({
        name: schemaName,
        note: schemaName === DEFAULT_SCHEMA_NAME ? `Default ${_.capitalize(DEFAULT_SCHEMA_NAME)} Schema` : '',
        database: this,
      });

      this.pushSchema(schema);
    }

    return schema;
  }

  findTable (rawTable) {
    const schema = this.findOrCreateSchema(rawTable.schemaName || DEFAULT_SCHEMA_NAME);
    if (!schema) {
      this.error(`Schema ${rawTable.schemaName || DEFAULT_SCHEMA_NAME} don't exist`);
    }
    return schema.findTable(rawTable.name);
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
      schemas: this.schemas.map(s => s.export()),
    };
  }

  exportChildIds () {
    return {
      schemaIds: this.schemas.map(s => s.id),
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
      refs: {},
      enums: {},
      tableGroups: {},
      tags: {},
      tables: {},
      endpoints: {},
      enumValues: {},
      indexes: {},
      indexColumns: {},
      fields: {},
    };

    this.schemas.forEach((schema) => schema.normalize(normalizedModel));
    return normalizedModel;
  }
}

export default Database;
