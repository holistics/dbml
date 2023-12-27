import { benchmarkSuite } from 'jest-bench';
import fs from 'fs';
import path from 'path';

import importer from '../src/import';

const mySQL = fs.readFileSync(path.join(process.cwd(), './__benchmarks__/mysql.sql'), 'utf-8');
// const mySQL2 = fs.readFileSync(path.join(process.cwd(), './__benchmarks__/mysql2.sql'), 'utf-8');

benchmarkSuite('Postgres parser suite', {
  setup () {

  },
  teardown () {

  },

  'Legacy Mysql parser small sql': () => {
    importer.import(mySQL, 'mysqlLegacy');
  },

  // 'Legacy Mysql parser huge sql': () => {
  //   importer.import(mySQL2, 'mysqlLegacy');
  // },

  'ANTLR Mysql parser small sql': () => {
    importer.import(mySQL, 'mysql');
  },

  // 'ANTLR Mysql parser huge sql': () => {
  //   importer.import(mySQL2, 'mysql');
  // },
}, 1200000);
