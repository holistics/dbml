import fs from 'fs';
import path from 'path';
import { scanDirNames } from '../jestHelpers.ts';
import { connector } from '../src/index.ts';

const sortKeys = (obj: any): any => {
  if (Array.isArray(obj)) {
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
  });
});
