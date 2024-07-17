/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */

import connector from '../../src/connector';

// $ dbdocs db2dbml -postgresql --host=<db-host> --port=<db-port> --dbname=<db-name> --user=<username> --password=<password> --output=database.dbml
describe('@dbml/core - connector', () => {
  const connection = {};

  const runTest = async (testName, conn, format) => {
    const res = await connector.fetch(conn, format);
    const output = require(`./output/${testName}.out.dbml`);

    expect(res).toBe(output);
  };

  const testName = 'connector';
  test('What a test', async () => {
    await runTest(testName, connection, 'postgres');
  });
});
