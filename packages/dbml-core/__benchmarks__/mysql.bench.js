import { bench, describe } from 'vitest';
import fs from 'fs';
import path from 'path';

import importer from '../src/import';

const mySQL = fs.readFileSync(path.join(process.cwd(), './__benchmarks__/mysql.sql'), 'utf-8');
const mySQL2 = fs.readFileSync(path.join(process.cwd(), './__benchmarks__/mysql2.sql'), 'utf-8');

describe('Mysql parser suite', () => {
  bench('Legacy Mysql parser small sql', () => {
    importer.import(mySQL, 'mysqlLegacy');
  });

  bench('Legacy Mysql parser large sql', () => {
    importer.import(mySQL2, 'mysqlLegacy');
  });

  bench('Legacy Mysql parser huge sql', () => {
    importer.import(mySQL2, 'mysqlLegacy');
  });

  bench('ANTLR Mysql parser small sql', () => {
    importer.import(mySQL, 'mysql');
  });

  bench('ANTLR Mysql parser huge sql', () => {
    importer.import(mySQL2, 'mysql');
  });
});
