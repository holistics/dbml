import { get } from 'lodash';
import Element from './element';
import { DEFAULT_SCHEMA_NAME } from './config';
import Check from './check';

class Field extends Element {
  constructor ({
    name, type, unique, pk, token, not_null: notNull, note, dbdefault,
    increment, checks = [], table = {}, noteToken = null, injectedPartial = null, injectedToken = null,
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
    this.note = note ? get(note, 'value', note) : null;
    this.noteToken = note ? get(note, 'token', noteToken) : null;
    this.dbdefault = dbdefault;
    this.increment = increment;
    this.checks = [];
    this.endpoints = [];
    this.table = table;
    this.injectedPartial = injectedPartial;
    this.injectedToken = injectedToken;
    this.dbState = this.table.dbState;
    this.generateId();
    this.bindType();

    this.processChecks(checks);
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
        // SQL allow definition of non-enum type to be used as column type, which we don't have equivalent dbml counterpart.
        // So instead of throwing errors on those type, we can view the type as plain text for the purpose of importing to dbml.
        this.type.type_name = `${typeSchemaName}.${typeName}`;
        // We set this field to avoid doubling schema name when exporting this type to SQL
        // e.g. to avoid `schema.schema.type`
        this.type.originalTypeName = typeName;
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
      injectedPartialId: this.injectedPartial?.id,
      checkIds: this.checks.map((check) => check.id),
    };
  }

  normalize (model) {
    model.fields[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportChildIds(),
      ...this.exportParentIds(),
    };

    this.checks.forEach((check) => check.normalize(model));
  }

  processChecks (checks) {
    checks.forEach((check) => {
      this.checks.push(new Check({ ...check, table: this.table, column: this }));
    });
  }
}

export default Field;
