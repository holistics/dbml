import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import stripAnsi from 'strip-ansi';
import { scanDirectoryNames } from './testHelpers';

const exec = util.promisify(childProcess.exec);

describe('@dbml/cli', () => {
  const runTest = async (directoryName: string, binFile: string) => {
    process.chdir(directoryName);
    const args = [path.join(__dirname, binFile)];
    const optionsRaw = fs.readFileSync(path.join(directoryName, './options.json'), 'utf-8');
    const options = JSON.parse(optionsRaw);
    args.push(...options.args);

    const isOutFile = fs.existsSync(path.join(directoryName, './expect-out-files'));
    if (isOutFile && !fs.existsSync(path.join(directoryName, './out-files'))) {
      fs.mkdirSync(path.join(directoryName, './out-files'));
    }

    const {
      stdout,
    } = await exec(`node ${args.join(' ')}`);
    const expectStdout = fs.readFileSync(path.join(directoryName, './stdout.txt'), 'utf-8');
    const actualStdout = stripAnsi(stdout);

    // folder name contains `error`
    if (path.basename(directoryName).includes('error')) {
      expect(actualStdout).toContain(expectStdout);
    } else {
      expect(actualStdout).toBe(expectStdout);
    }

    if (isOutFile) {
      const fileNames = fs.readdirSync(path.join(directoryName, './out-files'));
      let content = fs.readFileSync(path.join(directoryName, './out-files', fileNames[0]), 'utf-8');
      if (binFile === '../bin/dbml2sql.js') content = content.replace(/--.*(?:\n)*/g, '');

      content = content.replaceAll('\r\n', '\n');
      const expectContent = fs.readFileSync(path.join(directoryName, './expect-out-files', fileNames[0]), 'utf-8');
      expect(content).toBe(expectContent);
    }
  };

  const timeout = 100000;

  test.each(scanDirectoryNames(__dirname, 'dbml2sql'))('dbml2sql/%s', async (directoryName) => {
    await runTest(path.join(__dirname, 'dbml2sql', directoryName), '../bin/dbml2sql.js');
  }, timeout);

  test.each(scanDirectoryNames(__dirname, 'sql2dbml'))('sql2dbml/%s', async (directoryName) => {
    await runTest(path.join(__dirname, 'sql2dbml', directoryName), '../bin/sql2dbml.js');
  }, timeout);

  test.each(scanDirectoryNames(__dirname, 'db2dbml'))('db2dbml/%s', async (directoryName) => {
    await runTest(path.join(__dirname, 'db2dbml', directoryName), '../bin/db2dbml.js');
  }, timeout);
});
