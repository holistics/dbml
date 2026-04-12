import Element, { Token } from './element';
import { DEFAULT_SCHEMA_NAME } from './config';
import { shouldPrintSchema, shouldPrintSchemaName } from './utils';
import Field from './field';
import Ref from './ref';
import DbState from './dbState';
import Table from './table';

export interface RawEndpoint {
  schemaName: string | null;
  tableName: string;
  fieldNames: string[];
  relation: '1' | '*';
  token: Token;
}

class Endpoint extends Element {
  relation: any;
  schemaName: string;
  tableName: string;
  fieldNames: string[];
  fields: Field[];
  ref: Ref;
  dbState: DbState;

  constructor ({
    tableName, schemaName, fieldNames, relation, token, ref,
  }: { tableName: string; schemaName: string; fieldNames: string[]; relation: any; token: Token; ref: Ref }) {
    super(token);
    this.relation = relation;

    this.schemaName = schemaName;
    this.tableName = tableName;
    this.fieldNames = fieldNames;
    this.fields = [];
    this.ref = ref;
    this.dbState = this.ref.dbState;
    this.generateId();
    // Use name of schema,table and field object
    // Name in constructor could be alias
    const schema = ref.schema.database.findOrCreateSchema(schemaName || DEFAULT_SCHEMA_NAME);

    const table = schema.database.findTable(schemaName, tableName);
    if (!table) {
      this.error(`Can't find table ${shouldPrintSchemaName(schemaName)
        ? `"${schemaName}".`
        : ''}"${tableName}"`);
    }
    this.setFields(fieldNames, table!);
  }

  generateId () {
    this.id = this.dbState.generateId('endpointId');
  }

  equals (endpoint: Endpoint): boolean {
    if (this.fields.length !== endpoint.fields.length) return false;
    return this.compareFields(endpoint);
  }

  compareFields (endpoint: Endpoint): boolean {
    const sortedThisFieldIds = this.fields.map((field) => field.id).sort();
    const sortedEndpointFieldIds = endpoint.fields.map((field) => field.id).sort();
    for (let i = 0; i < sortedThisFieldIds.length; i += 1) {
      if (sortedThisFieldIds[i] !== sortedEndpointFieldIds[i]) return false;
    }
    return true;
  }

  export () {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds () {
    return {
      refId: this.ref.id,
      fieldIds: this.fields.map((field) => field.id),
    };
  }

  shallowExport () {
    return {
      schemaName: this.schemaName,
      tableName: this.tableName,
      fieldNames: this.fieldNames,
      relation: this.relation,
    };
  }

  setFields (fieldNames: string[], table: Table) {
    let newFieldNames = (fieldNames && fieldNames.length) ? [...fieldNames] : [];
    if (!newFieldNames.length) {
      const fieldHasPK = table.fields.find((field) => field.pk);
      if (fieldHasPK) {
        newFieldNames.push(fieldHasPK.name);
      } else {
        const indexHasPK = table.indexes.find((index) => index.pk);
        if (indexHasPK) {
          newFieldNames = indexHasPK.columns.map((column) => column.value);
        } else {
          this.error(`Can't find primary or composite key in table ${shouldPrintSchema(table.schema) ? `"${table.schema.name}".` : ''}"${table.name}"`);
        }
      }
    }
    newFieldNames.forEach((fieldName) => {
      const field = table.findField(fieldName);
      if (!field) {
        this.error(`Can't find field ${shouldPrintSchema(table.schema)
          ? `"${table.schema.name}".`
          : ''}"${fieldName}" in table "${table.name}"`);
      }
      this.fields.push(field!);
      field!.pushEndpoint(this);
    });
  }

  normalize (model: any) {
    model.endpoints[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default Endpoint;
