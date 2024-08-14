import path from 'path';
import fs from 'fs';
import { scanDirNames } from '../jestHelpers';
import { connector } from '../src/index';

describe('@dbml/connector', () => {
  const runTest = async (dirName) => {
    console.log(dirName);
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
    expect(contentJson).toBe(expectContent);
  };


  test.each(scanDirNames(__dirname, 'connectors'))('connectors/%s', async (dirName) => {
    await runTest(path.join(__dirname, 'connectors', dirName));
  });
});

