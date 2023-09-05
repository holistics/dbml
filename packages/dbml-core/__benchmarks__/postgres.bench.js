import { benchmarkSuite } from 'jest-bench';
import fs from 'fs';
import path from 'path';

// import importer from '../lib/import';
import importer from '../src/import';

const postgreSQL = fs.readFileSync(path.join(process.cwd(), './__benchmarks__/postgres.sql'), 'utf-8');
const postgreSQL2 = fs.readFileSync(path.join(process.cwd(), './__benchmarks__/postgres2.sql'), 'utf-8');

benchmarkSuite('Postgres parser suite', {
  setup () {

  },
  teardown () {

  },

  'Legacy Postgres parser small sql': () => {
    importer.import(postgreSQL2, 'postgresLegacy');
  },

  'Legacy Postgres parser huge sql': () => {
    importer.import(postgreSQL, 'postgresLegacy');
  },

  'ANTLR Postgres parser small sql': () => {
    importer.import(postgreSQL2, 'postgres');
  },

  'ANTLR Postgres parser huge sql': () => {
    importer.import(postgreSQL, 'postgres');
  },
}, 1200000);
