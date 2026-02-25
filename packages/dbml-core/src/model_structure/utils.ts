import { DEFAULT_SCHEMA_NAME } from './config';

export function shouldPrintSchema (schema: any) {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && schema.database.hasDefaultSchema);
}

export function shouldPrintSchemaName (schemaName: any) {
  return schemaName !== DEFAULT_SCHEMA_NAME;
}
