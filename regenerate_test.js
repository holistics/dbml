const Importer = require('./packages/dbml-core/lib/import/index').default;
const fs = require('fs');

// Regenerate postgres cmd_create_table test
const postgresCmdInput = fs.readFileSync(
  './packages/dbml-core/__tests__/importer/postgres_importer/input/cmd_create_table.in.sql',
  'utf8'
);
const postgresCmdOutput = Importer.import(postgresCmdInput, 'postgres');
fs.writeFileSync(
  './packages/dbml-core/__tests__/importer/postgres_importer/output/cmd_create_table.out.dbml',
  postgresCmdOutput
);
console.log('Regenerated postgres cmd_create_table.out.dbml');

// Regenerate postgres db_dump test
const postgresDbInput = fs.readFileSync(
  './packages/dbml-core/__tests__/importer/postgres_importer/input/db_dump.in.sql',
  'utf8'
);
const postgresDbOutput = Importer.import(postgresDbInput, 'postgres');
fs.writeFileSync(
  './packages/dbml-core/__tests__/importer/postgres_importer/output/db_dump.out.dbml',
  postgresDbOutput
);
console.log('Regenerated postgres db_dump.out.dbml');
