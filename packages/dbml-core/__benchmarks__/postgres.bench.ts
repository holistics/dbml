import { bench, describe } from 'vitest';
import fs from 'fs';
import path from 'path';

// import importer from '../lib/import';
import importer from '../src/import';

const postgreSQL = fs.readFileSync(path.join(process.cwd(), './__benchmarks__/postgres.sql'), 'utf-8');
const postgreSQL2 = fs.readFileSync(path.join(process.cwd(), './__benchmarks__/postgres2.sql'), 'utf-8');

describe('Postgres parser suite', () => {
  bench('Legacy Postgres parser small sql', () => {
    importer.import(postgreSQL2, 'postgresLegacy');
  });

  bench('Legacy Postgres parser huge sql', () => {
    importer.import(postgreSQL, 'postgresLegacy');
  });

  bench('ANTLR Postgres parser small sql', () => {
    importer.import(postgreSQL2, 'postgres');
  });

  bench('ANTLR Postgres parser huge sql', () => {
    importer.import(postgreSQL, 'postgres');
  });
});
