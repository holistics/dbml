import { DEFAULT_SCHEMA_NAME } from './config';
import type Schema from './schema';

export function shouldPrintSchema (schema: Schema) {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && schema.database.hasDefaultSchema);
}

export function shouldPrintSchemaName (schemaName: string) {
  return schemaName !== DEFAULT_SCHEMA_NAME;
}
