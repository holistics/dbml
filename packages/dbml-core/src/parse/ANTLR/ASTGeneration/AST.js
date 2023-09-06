/* eslint-disable max-classes-per-file */
export class Index {
  constructor ({ name, unique, pk, type, columns }) {
    /** @type {string} */
    this.name = name;

    /** @type {string} */
    this.type = type;

    /** @type {boolean} */
    this.unique = unique;

    /** @type {boolean} */
    this.pk = pk;

    /** @type {{value: string, type: string}[]} */
    this.columns = columns;
  }

  toJSON () {
    return {
      name: this.name,
      type: this.type,
      unique: this.unique,
      pk: this.pk,
      columns: this.columns,
    };
  }
}

export class Field {
  /** @type {boolean} */
  // fk;

  constructor ({ name, type, not_null, increment, dbdefault, unique, pk, note }) {
    /** @type {string} */
    this.name = name;

    /** @type {{type_name: string, schemaName: string}} */
    this.type = type;

    /** @type {boolean} */
    this.not_null = not_null;

    /** @type {boolean} */
    this.increment = increment;

    /** @type {{value: string, type: 'string'}} */
    this.dbdefault = dbdefault;

    /** @type {boolean} */
    this.unique = unique;

    /** @type {boolean} */
    this.pk = pk;

    /** @type {string} */
    this.note = note;
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
    };
  }
}

export class Table {
  constructor ({ name, schemaName, fields, indexes, note }) {
    /** @type {string} */
    this.name = name;

    /** @type {string} */
    this.schemaName = schemaName;

    /** @type {Array<Field>} */
    this.fields = fields || [];

    /** @type {Array<Index>} */
    this.indexes = indexes || [];

    /** @type {string} */
    this.note = note;
  }

  toJSON () {
    return {
      name: this.name,
      schemaName: this.schemaName,
      fields: this.fields?.map(f => f.toJSON()),
      indexes: this.indexes?.map(i => i.toJSON()),
      note: this.note,
    };
  }
}

export class Endpoint {
  constructor ({ tableName, schemaName, fieldNames, relation }) {
    /** @type {string} */
    this.tableName = tableName;

    /** @type {string} */
    this.schemaName = schemaName;

    /** @type {string[]} */
    this.fieldNames = fieldNames;

    /** @type {string} */
    this.relation = relation;
  }

  toJSON () {
    return {
      tableName: this.tableName,
      schemaName: this.schemaName,
      fieldNames: this.fieldNames,
      relation: this.relation,
    };
  }
}

export class Ref {
  constructor ({ name, endpoints, onDelete, onUpdate }) {
    /** @type {string} */
    this.name = name;

    /** @type {Array<Endpoint>} */
    this.endpoints = endpoints || [];

    /** @type {string} */
    this.onDelete = onDelete;

    /** @type {string} */
    this.onUpdate = onUpdate;
  }

  toJSON () {
    return {
      name: this.name,
      onDelete: this.onDelete,
      onUpdate: this.onUpdate,
      endpoints: this.endpoints.map(e => e.toJSON()),
    };
  }
}

export class Enum {
  constructor ({ name, schemaName, values }) {
    /** @type {string} */
    this.name = name;

    /** @type {string} */
    this.schemaName = schemaName;

    /** @type {{name: string}[]} */
    this.values = values;
  }

  toJSON () {
    return {
      name: this.name,
      schemaName: this.schemaName,
      values: this.values,
    };
  }
}
