// AST classes used by databaseGenerator.js

export class Index {
  constructor ({ name, unique, pk, type, columns }) {
    this.name = name;
    this.type = type;
    this.unique = unique;
    this.pk = pk;
    this.columns = columns;
  }

  toJSON () {
    return { name: this.name, type: this.type, unique: this.unique, pk: this.pk, columns: this.columns };
  }
}

export class Field {
  constructor ({ name, type, not_null, increment, dbdefault, unique, pk, note, checks }) {
    this.name = name;
    this.type = type;
    this.not_null = not_null;
    this.increment = increment;
    this.dbdefault = dbdefault;
    this.unique = unique;
    this.pk = pk;
    this.note = note;
    this.checks = checks;
  }

  toJSON () {
    return {
      name: this.name,
      type: this.type,
      not_null: this.not_null,
      increment: this.increment,
      dbdefault: this.dbdefault,
      unique: this.unique,
      pk: this.pk,
      note: this.note,
      checks: this.checks,
    };
  }
}

export class Table {
  constructor ({ name, schemaName, fields, indexes, note, checks }) {
    this.name = name;
    this.schemaName = schemaName;
    this.fields = fields || [];
    this.indexes = indexes || [];
    this.note = note;
    this.checks = checks || [];
  }

  toJSON () {
    return {
      name: this.name,
      schemaName: this.schemaName,
      fields: this.fields?.map((f) => f.toJSON()),
      indexes: this.indexes?.map((i) => i.toJSON()),
      note: this.note,
      checks: this.checks,
    };
  }
}

export class Endpoint {
  constructor ({ tableName, schemaName, fieldNames, relation }) {
    this.tableName = tableName;
    this.schemaName = schemaName;
    this.fieldNames = fieldNames;
    this.relation = relation;
  }

  toJSON () {
    return { tableName: this.tableName, schemaName: this.schemaName, fieldNames: this.fieldNames, relation: this.relation };
  }
}

export class Ref {
  constructor ({ name, endpoints, onDelete, onUpdate }) {
    this.name = name;
    this.endpoints = endpoints || [];
    this.onDelete = onDelete;
    this.onUpdate = onUpdate;
  }

  toJSON () {
    return { name: this.name, onDelete: this.onDelete, onUpdate: this.onUpdate, endpoints: this.endpoints.map((e) => e.toJSON()) };
  }
}

export class Enum {
  constructor ({ name, schemaName, values }) {
    this.name = name;
    this.schemaName = schemaName;
    this.values = values;
  }

  toJSON () {
    return { name: this.name, schemaName: this.schemaName, values: this.values };
  }
}

export class TableRecord {
  constructor ({ tableName, columns, values, schemaName = undefined }) {
    this.tableName = tableName;
    this.schemaName = schemaName;
    this.columns = columns;
    this.values = values;
  }

  toJSON () {
    return { tableName: this.tableName, schemaName: this.schemaName, columns: this.columns, values: this.values };
  }
}
