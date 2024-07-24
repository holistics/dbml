/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */

import fs from 'fs';
import connector from '../../src/connector';

// $ dbdocs db2dbml -postgresql --host=<db-host> --port=<db-port> --dbname=<db-name> --user=<username> --password=<password> --output=database.dbml
describe('@dbml/core - connector', () => {
  const connection = {
    user: 'huyphung',
    host: 'localhost',
    database: 'shopify',
    password: '',
    port: '5432',
  };

  const postgresConnectorPath = './postgres_connector.dbml';

  const runTest = async (testName, conn, format) => {
    const res = await connector.fetch(conn, format);
    const output = require(`./output/${testName}.out.dbml`);

    fs.writeFileSync(postgresConnectorPath, res, 'utf8');
    expect(res).toBe(output);
  };

  const testName = 'connector';
  test('What a test', async () => {
    await runTest(testName, connection, 'postgres');
  });
});
