const Parser = require('./packages/dbml-core/lib/parse/Parser').default;
const fs = require('fs');

// Test MySQL ALTER TABLE CHECK constraints
const mysqlInput = fs.readFileSync(
  './packages/dbml-core/__tests__/parser/mysql-parse/input/alter_table_check_constraints.in.sql',
  'utf8'
);
const mysqlOutput = Parser.parseMySQLToJSONv2(mysqlInput);
fs.writeFileSync(
  './packages/dbml-core/__tests__/parser/mysql-parse/output/alter_table_check_constraints.out.json',
  JSON.stringify(mysqlOutput, null, 2) + '\n'
);
console.log('Generated MySQL alter_table_check_constraints.out.json');
console.log(JSON.stringify(mysqlOutput, null, 2));
