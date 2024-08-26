// Inputs: schemas string -> Output: schema array string[]
// schema1, schema2 -> ['schema1', 'schema2']
// schema3,schema4 -> ['schema3", 'schema4']
// "schema5,gg", "schema6", schema7 -> ['schema5,gg', 'schema6', 'schema7']
// schema8 -> ['schema8']
export const parseSchema = (schemas: string): string[] => {
  const schemasWithDoubleQuotes = schemas.split(/,(?=(?:[^"]*(?:"[^"]*")*)*$)/).map((s) => s.trim());
  return schemasWithDoubleQuotes.map((s) => s.replace(/"/g, ''));
};
