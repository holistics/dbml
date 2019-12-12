import _ from 'lodash';
import Schema from './schema';
import Ref from './ref';
import Enum from './enum';
import TableGroup from './tableGroup';
import Table from './table';
import Element from './element';
import { DEFAULT_SCHEMA_NAME } from './config';

class Database extends Element {
  constructor ({ schemas = [], tables = [], enums = [], refs = [], tableGroups = [] }) {
    super();
    this.schemas = [];
    this.refs = [];

    // The process order is important. Do not change !
    this.processSchemas(schemas);
    this.processTables(tables);
    this.processRefs(refs);
    this.processEnums(enums);
    this.processTableGroups(tableGroups);
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
      } else {
        schema = this.findSchema(DEFAULT_SCHEMA_NAME);
      }
      schema.pushTable(new Table({ ...table, schema }));
    });
  }

  findSchema (schemaName) {
    let schema = this.schemas.find(s => s.name === schemaName || s.alias === schemaName);
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
    rawRefs.forEach((ref) => {
      this.pushRef(new Ref({ ...ref, database: this }));
    });
  }

  pushRef (ref) {
    this.checkRef(ref);
    this.refs.push(ref);
  }

  checkRef (ref) {
    if (this.refs.some(r => r.equals(ref))) {
      ref.error('Reference with same endpoints duplicated');
    }
  }

  processEnums (rawEnums) {
    let schema;
    rawEnums.forEach((_enum) => {
      if (_enum.schemaName) {
        schema = this.findSchema(_enum.schemaName);
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

  exportChild () {
    return {
      schemas: this.schemas.map(s => s.export()),
      refs: this.refs.map(r => r.export()),
    };
  }

  exportChildIds () {
    return {
      schema_ids: this.schemas.map(s => s.id),
      ref_ids: this.refs.map(r => r.id),
    };
  }

  normalize () {
    const normalizedModel = {
      database: {
        [this.id]: {
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
    this.refs.forEach((ref) => ref.normalize(normalizedModel));

    return normalizedModel;
  }
}

export default Database;
