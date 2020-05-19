import { DEFAULT_SCHEMA_NAME } from '../model_structure/config';

export function hasWhiteSpace (s) {
  return /\s/g.test(s);
}

export function shouldPrintSchema (schema, model) {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && model.database['1'].hasDefaultSchema);
}
