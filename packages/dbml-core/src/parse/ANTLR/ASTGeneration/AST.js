/* eslint-disable camelcase */
/* eslint-disable max-classes-per-file */
export class Index {
  /**
   * @param {{
   *  name: string,
   *  unique: boolean,
   *  pk: boolean,
   *  type: string,
   *  columns: {value: string, type: 'column' | 'string' | 'expression'}[],
   * }} param0
   */
  constructor ({ name, unique, pk, type, columns }) {
    /** @type {string} */
    this.name = name;

    /** @type {string} */
    this.type = type;

    /** @type {boolean} */
    this.unique = unique;

    /** @type {boolean} */
    this.pk = pk;

    /** @type {{value: string, type: 'column' | 'string' | 'expression'}[]} */
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

  /**
   * @param {{
   *  name: string,
   *  type: {type_name: string, schemaName: string},
   *  not_null: boolean,
   *  increment: boolean,
   *  dbdefault: {value: string, type: 'string' | 'number' | 'boolean' | 'expression'},
   *  unique: boolean,
   *  pk: boolean,
   *  note: {value: string}
   * }} param0
   */
  constructor ({ name, type, not_null, increment, dbdefault, unique, pk, note }) {
    /** @type {string} */
    this.name = name;

    /** @type {{type_name: string, schemaName: string}} */
    this.type = type;

    /** @type {boolean} */
    this.not_null = not_null;

    /** @type {boolean} */
    this.increment = increment;

    /** @type {{value: string, type: 'string' | 'number' | 'boolean' | 'expression'}} */
    this.dbdefault = dbdefault;

    /** @type {boolean} */
    this.unique = unique;

    /** @type {boolean} */
    this.pk = pk;

    /** @type {{value: string}} */
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
  /**
   * @param {{
   *  name: string,
   *  schemaName: string,
   *  fields: Field[],
   *  indexes: Index[],
   *  note: {value: string}
   * }} param0
   */
  constructor ({ name, schemaName, fields, indexes, note }) {
    /** @type {string} */
    this.name = name;

    /** @type {string} */
    this.schemaName = schemaName;

    /** @type {Field[]} */
    this.fields = fields || [];

    /** @type {Index[]} */
    this.indexes = indexes || [];

    /** @type {{value: string}} */
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
  /**
   * @param {{
   *  tableName: string,
   *  schemaName: string,
   *  fieldNames: string[],
   *  relation: '*' | '1'
   * }} param0
   */
  constructor ({ tableName, schemaName, fieldNames, relation }) {
    /** @type {string} */
    this.tableName = tableName;

    /** @type {string} */
    this.schemaName = schemaName;

    /** @type {string[]} */
    this.fieldNames = fieldNames;

    /** @type {'*' | '1'} */
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
  /**
   * @param {{
   *  name: string,
   *  endpoints: Endpoint[],
   *  onDelete: string,
   *  onUpdate: string
   * }} param0
   */
  constructor ({ name, endpoints, onDelete, onUpdate }) {
    /** @type {string} */
    this.name = name;

    /** @type {Endpoint[]} */
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
