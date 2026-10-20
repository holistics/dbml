import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import stripAnsi from 'strip-ansi';
import {
  scanDirNames,
} from './testHelpers';

const exec = util.promisify(childProcess.exec);

// Only run on Windows - skipped on other platforms
const describeOnWindows = process.platform === 'win32' ? describe : describe.skip;

describeOnWindows('@dbml/cli - Windows paths', () => {
  const runTest = async (dirName: string) => {
    process.chdir(dirName);
    const binFile = path.join(__dirname, '../bin/dbml2sql.js');
    const optsRaw = fs.readFileSync(path.join(dirName, './options.json'), 'utf-8');
    const opts = JSON.parse(optsRaw);

    const {
      stdout,
    } = await exec(`node "${binFile}" ${opts.args.join(' ')}`);
    const expectStdout = fs.readFileSync(path.join(dirName, './stdout.txt'), 'utf-8').replaceAll('\r\n', '\n');
    const actualStdout = stripAnsi(stdout).replaceAll('\r\n', '\n');

    expect(actualStdout).toBe(expectStdout);
  };

  test.each(scanDirNames(__dirname, 'windows'))('windows/%s', async (dirName) => {
    await runTest(path.join(__dirname, 'windows', dirName));
  }, 100000);
});
