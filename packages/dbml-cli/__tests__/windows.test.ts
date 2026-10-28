import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import stripAnsi from 'strip-ansi';
import { scanDirectoryNames } from './testHelpers';

const exec = util.promisify(childProcess.exec);

// Only run on Windows - skipped on other platforms
const describeOnWindows = process.platform === 'win32' ? describe : describe.skip;

describeOnWindows('@dbml/cli - Windows paths', () => {
  const runTest = async (directoryName: string) => {
    process.chdir(directoryName);
    const binFile = path.join(__dirname, '../bin/dbml2sql.js');
    const optionsRaw = fs.readFileSync(path.join(directoryName, './options.json'), 'utf-8');
    const options = JSON.parse(optionsRaw);

    const {
      stdout,
    } = await exec(`node "${binFile}" ${options.args.join(' ')}`);
    const expectStdout = fs.readFileSync(path.join(directoryName, './stdout.txt'), 'utf-8').replaceAll('\r\n', '\n');
    const actualStdout = stripAnsi(stdout).replaceAll('\r\n', '\n');

    expect(actualStdout).toBe(expectStdout);
  };

  test.each(scanDirectoryNames(__dirname, 'windows'))('windows/%s', async (directoryName) => {
    await runTest(path.join(__dirname, 'windows', directoryName));
  }, 100000);
});
