const Parser = require('./packages/dbml-core/lib/parse/Parser').default;
const fs = require('fs');

// Test PostgreSQL ALTER TABLE CHECK constraints
const postgresInput = fs.readFileSync(
  './packages/dbml-core/__tests__/parser/postgres-parse/input/alter_table_check_constraints.in.sql',
  'utf8'
);
const postgresOutput = Parser.parsePostgresToJSONv2(postgresInput);
fs.writeFileSync(
  './packages/dbml-core/__tests__/parser/postgres-parse/output/alter_table_check_constraints.out.json',
  JSON.stringify(postgresOutput, null, 2) + '\n'
);
console.log('Generated PostgreSQL alter_table_check_constraints.out.json');
console.log(JSON.stringify(postgresOutput, null, 2));
