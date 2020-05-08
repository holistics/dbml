import Element from './element';
import { DEFAULT_SCHEMA_NAME } from './config';
import { shouldPrintSchema } from './utils';

class Endpoint extends Element {
  constructor ({ tableName, schemaName, fieldName, relation, token, ref }) {
    super(token);
    this.relation = relation;

    this.schemaName = schemaName;
    this.tableName = tableName;
    this.fieldName = fieldName; // can be an array of names
    this.fields = [];
    this.ref = ref;
    this.dbState = this.ref.dbState;
    this.generateId();
    // Use name of schema,table and field object
    // Name in constructor could be alias
    const schema = ref.schema.database.findOrCreateSchema(schemaName || DEFAULT_SCHEMA_NAME);

    const table = schema.findTable(tableName);
    if (!table) {
      this.error(`Can't find table ${shouldPrintSchema(schema)
        ? `"${schema.name}".` : ''}"${tableName}"`);
    }
    this.setFields(fieldName, table) 
  }

  generateId () {
    this.id = this.dbState.generateId('endpointId');
  }

  equals (endpoint) {
    if (this.fields.length != endpoint.fields.length) return false;
    return this.fields.length == 1 ? this.field.id === endpoint.field.id : this.compareFields(endpoint);
  }

  compareFields(endpoint){
    let sortedThisFields = this.fields.slice().sort();
    let sortedEndpointFields = endpoint.fields.slice().sort();
    for (let i = 0; i < sortedThisFields.length; i++){
      if (sortedThisFields[i] != sortedEndpointFields[i]) return false;  
    }
    return true;
  }
  export () {
    return {
      ...this.shallowExport(),
      fieldName: this.fieldName
    };
  }
  exportParentIds () {
    return {
      refId: this.ref.id,
      fieldIds: this.fields,
      fieldId: this.field.id
    };
  }

  shallowExport () {
    return {
      schemaName: this.schemaName,
      tableName: this.tableName,
      //fieldName: this.fieldName,
      relation: this.relation,
    };
  }
  
  setFields (fieldNames, table) {
    if (typeof fieldNames == "string") fieldNames = [fieldNames] 
    fieldNames.forEach(fieldName => {
      const field = table.findField(fieldName);
      this.setField(field, table);
    });
  }

  setField (field, table) {
    if (!field) {
      this.error(`Can't find field ${shouldPrintSchema(table.schema)
        ? `"${table.schema.name}".` : ''}"${field.name}" in table "${this.tableName}"`);
    }
    if (!this.field) this.field = field;
    this.fields.push(field.id);
    field.pushEndpoint(this);
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
