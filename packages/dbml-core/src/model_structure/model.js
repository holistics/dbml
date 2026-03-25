import Database from './database';
import DbState from './dbState';

class Model {
  constructor ({
    databases = [],
  } = {}) {
    this.dbState = new DbState();
    this.databases = databases.map((db) => {
      db.dbState = this.dbState;
      return new Database(db);
    });
  }

  normalize () {
    const result = {
      database: {},
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

    for (const db of this.databases) {
      const normalized = db.normalize();
      Object.assign(result.database, normalized.database);
      Object.assign(result.schemas, normalized.schemas);
      Object.assign(result.notes, normalized.notes);
      Object.assign(result.refs, normalized.refs);
      Object.assign(result.enums, normalized.enums);
      Object.assign(result.tableGroups, normalized.tableGroups);
      Object.assign(result.tables, normalized.tables);
      Object.assign(result.endpoints, normalized.endpoints);
      Object.assign(result.enumValues, normalized.enumValues);
      Object.assign(result.indexes, normalized.indexes);
      Object.assign(result.indexColumns, normalized.indexColumns);
      Object.assign(result.checks, normalized.checks);
      Object.assign(result.fields, normalized.fields);
      Object.assign(result.records, normalized.records);
      Object.assign(result.tablePartials, normalized.tablePartials);
    }

    return result;
  }
}

export default Model;
