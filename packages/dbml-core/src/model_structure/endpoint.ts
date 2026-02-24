import Element, { Token } from './element';
import { DEFAULT_SCHEMA_NAME } from './config';
import { shouldPrintSchema, shouldPrintSchemaName } from './utils';
import Field from './field';
import Ref from './ref';
import DbState from './dbState';
import { NormalizedModel } from './database';

export interface RawEndpoint {
  schemaName: string | null;
  tableName: string;
  fieldNames: string[];
  relation: '1' | '*';
  token: Token;
}

export interface NormalizedEndpoint {
  id: number;
  schemaName: string | null;
  tableName: string;
  fieldNames: string[];
  fieldIds: number[];
  relation: string;
  refId: number;
}

export interface NormalizedEndpointIdMap {
  [_id: number]: NormalizedEndpoint;
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
  }: { tableName: any; schemaName: any; fieldNames: any; relation: any; token: any; ref: any }) {
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
    this.setFields(fieldNames, table);
  }

  generateId (): void {
    this.id = this.dbState.generateId('endpointId');
  }

  equals (endpoint: any): boolean {
    if (this.fields.length !== endpoint.fields.length) return false;
    return this.compareFields(endpoint);
  }

  compareFields (endpoint: any): boolean {
    const sortedThisFieldIds = this.fields.map((field) => field.id).sort();
    const sortedEndpointFieldIds = endpoint.fields.map((field: any) => field.id).sort();
    for (let i = 0; i < sortedThisFieldIds.length; i += 1) {
      if (sortedThisFieldIds[i] !== sortedEndpointFieldIds[i]) return false;
    }
    return true;
  }

  export (): { schemaName: string; tableName: string; fieldNames: string[]; relation: any } {
    return {
      ...this.shallowExport(),
    };
  }

  exportParentIds (): { refId: number; fieldIds: number[] } {
    return {
      refId: this.ref.id,
      fieldIds: this.fields.map((field) => field.id),
    };
  }

  shallowExport (): { schemaName: string; tableName: string; fieldNames: string[]; relation: any } {
    return {
      schemaName: this.schemaName,
      tableName: this.tableName,
      fieldNames: this.fieldNames,
      relation: this.relation,
    };
  }

  setFields (
    fieldNames: any,
    table: any,
  ): void {
    let newFieldNames = (fieldNames && fieldNames.length) ? [...fieldNames] : [];
    if (!newFieldNames.length) {
      const fieldHasPK = table.fields.find((field: any) => field.pk);
      if (fieldHasPK) {
        newFieldNames.push(fieldHasPK.name);
      } else {
        const indexHasPK = table.indexes.find((index: any) => index.pk);
        if (indexHasPK) {
          newFieldNames = indexHasPK.columns.map((column: any) => column.value);
        } else {
          this.error(`Can't find primary or composite key in table ${shouldPrintSchema(table.schema) ? `"${table.schema.name}".` : ''}"${table.name}"`);
        }
      }
    }
    newFieldNames.forEach((fieldName: string) => {
      const field = table.findField(fieldName);
      if (!field) {
        this.error(`Can't find field ${shouldPrintSchema(table.schema)
          ? `"${table.schema.name}".`
          : ''}"${fieldName}" in table "${table.name}"`);
      }
      this.fields.push(field);
      field.pushEndpoint(this);
    });
  }

  normalize (model: NormalizedModel): void {
    model.endpoints[this.id] = {
      id: this.id,
      ...this.shallowExport(),
      ...this.exportParentIds(),
    };
  }
}

export default Endpoint;
