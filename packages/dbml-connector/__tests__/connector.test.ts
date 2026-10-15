import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { scanDirNames } from './testHelpers';
import { connector } from '../src/index';

const sortKeys = (obj: any): any => {
  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null && 'name' in obj[0]) {
      return obj.map(sortKeys).sort((a, b) => (a.name > b.name ? 1 : -1));
    }
    return obj.map(sortKeys);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((result: any, key: string) => {
      result[key] = sortKeys(obj[key]);
      return result;
    }, {});
  }
  return obj;
};

describe('@dbml/connector', () => {
  const runTest = async (dirName: string) => {
    process.chdir(dirName);

    const connectionRaw = fs.readFileSync(path.join(dirName, './connection.json'), 'utf-8');
    const { connection, format } = JSON.parse(connectionRaw);

    if (!fs.existsSync(path.join(dirName, './out-files'))) {
      fs.mkdirSync(path.join(dirName, './out-files'));
    }

    const content = await connector.fetchSchemaJson(connection, format);
    fs.writeFileSync(path.join(dirName, './out-files/schema.json'), JSON.stringify(content, null, 2));
    const fileNames = fs.readdirSync(path.join(dirName, './out-files'));
    const contentJson = fs.readFileSync(path.join(dirName, './out-files', fileNames[0]), 'utf-8');
    const expectContent = fs.readFileSync(path.join(dirName, './expect-out-files', fileNames[0]), 'utf-8');

    const contentObj = JSON.parse(contentJson.replace(/\\r\\n/g, '\\n'));
    const expectObj = JSON.parse(expectContent.replace(/\\r\\n/g, '\\n'));

    expect(sortKeys(contentObj)).toEqual(sortKeys(expectObj));
  };

  test.each(scanDirNames(__dirname, 'connectors'))('connectors/%s', async (dirName) => {
    await runTest(path.join(__dirname, 'connectors', dirName));
  }, 10000);

  test('postgres preserves composite foreign key column order', async () => {
    const testDir = path.join(__dirname, 'connectors', 'postgres');
    const { connection } = JSON.parse(fs.readFileSync(path.join(testDir, 'connection.json'), 'utf-8'));
    const schema = `dbml_fk_order_${Math.random().toString(16).slice(2)}`;
    const client = new Client({ connectionString: connection });

    await client.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`
        CREATE TABLE "${schema}".parent (
          zeta integer NOT NULL,
          alpha integer NOT NULL,
          PRIMARY KEY (zeta, alpha)
        );
        CREATE TABLE "${schema}".child (
          id integer PRIMARY KEY,
          a_zeta integer,
          z_alpha integer,
          CONSTRAINT child_parent_fk FOREIGN KEY (a_zeta, z_alpha)
            REFERENCES "${schema}".parent (zeta, alpha)
        );
      `);

      const schemaJson = await connector.fetchSchemaJson(`${connection}?schemas=${schema}`, 'postgres');
      const ref = schemaJson.refs.find(({ name }) => name === 'child_parent_fk');

      expect(ref?.endpoints[0].fieldNames).toEqual(['a_zeta', 'z_alpha']);
      expect(ref?.endpoints[1].fieldNames).toEqual(['zeta', 'alpha']);
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });
});
