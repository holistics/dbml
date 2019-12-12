import Element from './element';

class Field extends Element {
  constructor ({ name, type, unique, pk, token, not_null, note, dbdefault,
    increment, table = {} } = {}) {
    super(token);
    if (!name) { this.error('Field must have a name'); }
    if (!type) { this.error('Field must have a type'); }
    this.name = name;
    // type : { type_name, value }
    this.type = type;
    this.unique = unique;
    this.pk = pk;
    this.not_null = not_null;
    this.note = note;
    this.dbdefault = dbdefault;
    this.increment = increment;
    this.table = table;
    this.endpoints = [];
  }

  pushEndpoint (endpoint) {
    this.endpoints.push(endpoint);
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds () {
    return {
      table_id: this.table.id,
      enum_id: this._enum ? this._enum.id : null,
    };
  }

  shallowExport () {
    return {
      name: this.name,
      type: this.type,
      unique: this.unique,
      pk: this.pk,
      not_null: this.not_null,
      note: this.note,
      dbdefault: this.dbdefault,
      increment: this.increment,
    };
  }

  normalize (model) {
    model.fields = {
      ...model.fields,
      [this.id]: {
        ...this.shallowExport(),
        ...this.exportParentIds(),
      },
    };
  }
}

export default Field;
