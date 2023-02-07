import Element from './element';
import { DEFAULT_SCHEMA_NAME } from './config';

class Field extends Element {
  constructor ({
    name, type, unique, pk, token, not_null: notNull, note, dbdefault,
    increment, table = {},
  } = {}) {
    super(token);
    if (!name) { this.error('Field must have a name'); }
    if (!type) { this.error('Field must have a type'); }
    this.name = name;
    // type : { type_name, value, schemaName }
    this.type = type;
    this.unique = unique;
    this.pk = pk;
    this.not_null = notNull;
    this.note = note ? note.value : null;
    this.noteToken = note ? note.token : null;
    this.dbdefault = dbdefault;
    this.increment = increment;
    this.endpoints = [];
    this.table = table;
    this.dbState = this.table.dbState;
    this.generateId();
    this.bindType();
  }

  generateId () {
    this.id = this.dbState.generateId('fieldId');
  }

  bindType () {
    const typeName = this.type.type_name;
    const typeSchemaName = this.type.schemaName || DEFAULT_SCHEMA_NAME;
    if (this.type.schemaName) {
      const _enum = this.table.schema.database.findEnum(typeSchemaName, typeName);
      if (!_enum) {
        this.error(`Cannot find type ${typeSchemaName} in schema ${typeSchemaName}`);
        return;
      }
      this._enum = _enum;
      _enum.pushField(this);
    } else {
      const _enum = this.table.schema.database.findEnum(typeSchemaName, typeName);
      if (!_enum) return;
      this._enum = _enum;
      _enum.pushField(this);
    }
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
      tableId: this.table.id,
      enumId: this._enum ? this._enum.id : null,
    };
  }

  exportChildIds () {
    return {
      endpointIds: this.endpoints.map(e => e.id),
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
        id: this.id,
        ...this.shallowExport(),
        ...this.exportChildIds(),
        ...this.exportParentIds(),
      },
    };
  }
}

export default Field;
