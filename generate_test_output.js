const Parser = require('./packages/dbml-core/lib/parse/Parser').default;
const fs = require('fs');

// Generate PostgreSQL check_constraints output
const postgresInput = fs.readFileSync(
  './packages/dbml-core/__tests__/parser/postgres-parse/input/check_constraints.in.sql',
  'utf8'
);
const postgresOutput = Parser.parsePostgresToJSONv2(postgresInput);
fs.writeFileSync(
  './packages/dbml-core/__tests__/parser/postgres-parse/output/check_constraints.out.json',
  JSON.stringify(postgresOutput, null, 2) + '\n'
);
console.log('Generated PostgreSQL check_constraints.out.json');

// Generate MySQL check_constraints output
const mysqlInput = fs.readFileSync(
  './packages/dbml-core/__tests__/parser/mysql-parse/input/check_constraints.in.sql',
  'utf8'
);
const mysqlOutput = Parser.parseMySQLToJSONv2(mysqlInput);
fs.writeFileSync(
  './packages/dbml-core/__tests__/parser/mysql-parse/output/check_constraints.out.json',
  JSON.stringify(mysqlOutput, null, 2) + '\n'
);
console.log('Generated MySQL check_constraints.out.json');
