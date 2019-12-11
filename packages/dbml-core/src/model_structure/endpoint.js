import Element from './element';
import { DEFAULT_SCHEMA_NAME } from './config';

class Endpoint extends Element {
  constructor ({ tableName, schemaName = DEFAULT_SCHEMA_NAME, fieldName, relation, token, ref }) {
    super(token);
    this.relation = relation;

    this.schemaName = schemaName;
    this.tableName = tableName;
    this.fieldName = fieldName;
    this.ref = ref;
    // Use name of schema,table and field object
    // Name in constructor could be alias
    const schema = ref.database.findSchema(schemaName);

    const table = schema.findTable(tableName);
    const field = table.findField(fieldName);
    this.setField(field);
  }

  equals (endpoint) {
    return this.field.id === endpoint.id;
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds () {
    return {
      ref_id: this.ref.id,
      field_id: this.field.id,
    };
  }

  shallowExport () {
    return {
      schemaName: this.schemaName,
      tableName: this.tableName,
      fieldName: this.fieldName,
      relation: this.relation,
    };
  }

  setField (field) {
    if (!field) {
      this.error(`Can't find field ${this.fieldName} in table ${this.tableName}`);
    }
    this.field = field;
  }

  normalize (model) {
    model.endpoints = {
      ...model.endpoints,
      [this.id]: {
        ...this.shallowExport(),
        ...this.exportParentIds(),
      },
    };
  }
}

export default Endpoint;
