export const parsePostgresSchema = (connectionString: string): string[] => {
  // postgresql://user:password@localhost:5432/dbname?schemas=schema1,schema2,schema3&ssl=true
  if (!connectionString.includes('schemas=')) return [];
  const connectionParts = connectionString.split('?');
  const connectionArgs = connectionParts[1].split('&');
  const schemasArg = connectionArgs.find((part) => part.includes('schemas='));
  const schemas = schemasArg ? parseSchema(schemasArg.split('=')[1]) : [];
  return schemas;
}

export const buildSchemaQuery = (columnName: string, schemas: string[], prefix = 'AND'): string => {
  if (schemas.length === 0) return '';
  return `${prefix} ${columnName} IN (${schemas.map((schema) => `'${schema}'`).join(', ')})`;
}

// Inputs: schemas string -> Output: schema array string[]
// schema1, schema2 -> ['schema1', 'schema2']
// schema3,schema4 -> ['schema3", 'schema4']
// "schema5,gg", "schema6", schema7 -> ['schema5,gg', 'schema6', 'schema7']
// schema8 -> ['schema8']
export const parseSchema = (schemas: string | undefined): string[] => {
  if (!schemas) return [];
  const schemasWithDoubleQuotes = schemas.split(/,(?=(?:[^"]*(?:"[^"]*")*)*$)/).map((s) => s.trim());
  return schemasWithDoubleQuotes.map((s) => s.replace(/"/g, ''));
};
