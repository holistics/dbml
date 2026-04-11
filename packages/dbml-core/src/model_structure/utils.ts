import { DEFAULT_SCHEMA_NAME } from './config';
import Schema from './schema';

export function shouldPrintSchema (schema: Schema): boolean {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && schema.database.hasDefaultSchema);
}

export function shouldPrintSchemaName (schemaName: string): boolean {
  return schemaName !== DEFAULT_SCHEMA_NAME;
}
