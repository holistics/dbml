import _ from 'lodash';
import Schema from './schema';
import Ref from './ref';
import Enum from './enum';
import TableGroup from './tableGroup';
import Table from './table';
import Element from './element';
import { DEFAULT_SCHEMA_NAME } from './config';
import DbState from './dbState';

class Database extends Element {
  constructor ({ schemas = [], tables = [], enums = [], refs = [], tableGroups = [] }) {
    super();
    this.dbState = new DbState();
    this.generateId();
    this.hasDefaultSchema = false;
    this.schemas = [];
    this.refs = [];

    // The process order is important. Do not change !
    this.processSchemas(schemas);
    this.processTables(tables);
    this.processRefs(refs);
    this.processEnums(enums);
    this.processTableGroups(tableGroups);
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

  processTables (rawTables) {
    let schema;

    rawTables.forEach((table) => {
      if (table.schemaName) {
        schema = this.findSchema(table.schemaName);
        if (table.schemaName === DEFAULT_SCHEMA_NAME) {
          this.hasDefaultSchema = true;
        }
      } else {
        schema = this.findSchema(DEFAULT_SCHEMA_NAME);
      }
      schema.pushTable(new Table({ ...table, schema }));
    });
  }

  findSchema (schemaName) {
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

  processRefs (rawRefs) {
    let schema;

    rawRefs.forEach((ref) => {
      if (ref.schemaName) {
        schema = this.findSchema(ref.schemaName);
        if (ref.schemaName === DEFAULT_SCHEMA_NAME) {
          this.hasDefaultSchema = true;
        }
      } else {
        schema = this.findSchema(DEFAULT_SCHEMA_NAME);
      }
      schema.pushRef(new Ref({ ...ref, schema }));
    });
  }

  processEnums (rawEnums) {
    let schema;
    rawEnums.forEach((_enum) => {
      if (_enum.schemaName) {
        schema = this.findSchema(_enum.schemaName);
        if (_enum.schemaName === DEFAULT_SCHEMA_NAME) {
          this.hasDefaultSchema = true;
        }
      } else {
        schema = this.findSchema(DEFAULT_SCHEMA_NAME);
      }
      schema.pushEnum(new Enum({ ..._enum, schema }));
    });
  }

  processTableGroups (rawTableGroups) {
    let schema;
    rawTableGroups.forEach((tableGroup) => {
      if (tableGroup.schemaName) {
        schema = this.findSchema(tableGroup.schemaName);
        if (tableGroup.schemaName === DEFAULT_SCHEMA_NAME) {
          this.hasDefaultSchema = true;
        }
      } else {
        schema = this.findSchema(DEFAULT_SCHEMA_NAME);
      }
      schema.pushTableGroup(new TableGroup({ ...tableGroup, schema }));
    });
  }

  findTable (rawTable) {
    const schema = this.findSchema(rawTable.schemaName || DEFAULT_SCHEMA_NAME);
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
