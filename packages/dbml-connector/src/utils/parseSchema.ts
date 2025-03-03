// You cannot use the "=" inside database's schema name. It will be treated as a delimiter.
const SCHEMAS_DELIMITER = 'schemas=';

const haveSchemas = (str: string): boolean => {
  return str.toLowerCase().includes(SCHEMAS_DELIMITER);
};

const getSchemasPart = (str: string | undefined): string => {
  return str ? str.toLowerCase().split(SCHEMAS_DELIMITER)[1] : '';
};

const noSchemaResult = (connectionString: string) => ({
  connectionString,
  schemas: [],
});

const parseOdbcSchema = (connectionString: string) => {
  const connectionParts = connectionString.split(';');
  const schemasPart = connectionParts.find((part) => haveSchemas(part));

  return {
    connectionString: connectionParts.filter((part) => !haveSchemas(part)).join(';'),
    schemas: parseSchema(getSchemasPart(schemasPart)),
  };
};

export const parseJdbcSchema = (connectionString: string) => {
  const connectionParts = connectionString.split('?');
  const connectionArgs = connectionParts[1].split('&');
  const schemasPart = connectionArgs.find((part) => haveSchemas(part));

  return {
    connectionString: connectionParts[0],
    schemas: parseSchema(getSchemasPart(schemasPart)),
  };
};

export const parseConnectionString = (connectionString: string, connectionStringType: 'jdbc' | 'odbc') => {
  if (!haveSchemas(connectionString)) return noSchemaResult(connectionString);

  return connectionStringType === 'jdbc'
    ? parseJdbcSchema(connectionString)
    : parseOdbcSchema(connectionString);
};

export const buildSchemaQuery = (columnName: string, schemas: string[], prefix = 'AND'): string => {
  if (schemas.length === 0) return '';
  return `${prefix} ${columnName} IN (${schemas.map((schema) => `'${schema}'`).join(', ')})`;
};

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
