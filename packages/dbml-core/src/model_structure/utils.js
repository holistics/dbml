import { DEFAULT_SCHEMA_NAME } from './config';

export function shouldPrintSchema (schema) {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && schema.database.hasDefaultSchema);
}

export function shouldPrintSchemaName (schemaName) {
  return schemaName !== DEFAULT_SCHEMA_NAME;
}

// TODO: This is an ad hoc function for parsing inserts. It should be replaced with a more robust solution
export function getFullTableName (schemaName, tableName) {
  return `${schemaName && shouldPrintSchemaName(schemaName) ? `${schemaName}.` : ''}${tableName}`;
}
