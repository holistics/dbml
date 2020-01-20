import Element from './element';
import { DEFAULT_SCHEMA_NAME } from './config';
import { shouldPrintSchema } from './utils';

class Endpoint extends Element {
  constructor ({ tableName, schemaName, fieldName, relation, token, ref }) {
    super(token);
    this.relation = relation;

    this.schemaName = schemaName;
    this.tableName = tableName;
    this.fieldName = fieldName;
    this.ref = ref;
    this.dbState = this.ref.dbState;
    this.generateId();
    // Use name of schema,table and field object
    // Name in constructor could be alias
    const schema = ref.schema.database.findSchema(schemaName || DEFAULT_SCHEMA_NAME);

    const table = schema.findTable(tableName);
    if (!table) {
      this.error(`Can't find table ${shouldPrintSchema(schema)
        ? `"${schema.name}".` : ''}"${tableName}"`);
    }
    const field = table.findField(fieldName);
    this.setField(field, table);
  }

  generateId () {
    this.id = this.dbState.generateId('endpointId');
  }

  equals (endpoint) {
    return this.field.id === endpoint.field.id;
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds () {
    return {
      refId: this.ref.id,
      fieldId: this.field.id,
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

  setField (field, table) {
    if (!field) {
      this.error(`Can't find field ${shouldPrintSchema(table.schema)
        ? `"${table.schema.name}".` : ''}"${this.fieldName}" in table "${this.tableName}"`);
    }
    this.field = field;
  }

  normalize (model) {
    model.endpoints = {
      ...model.endpoints,
      [this.id]: {
        id: this.id,
        ...this.shallowExport(),
        ...this.exportParentIds(),
      },
    };
  }
}

export default Endpoint;
