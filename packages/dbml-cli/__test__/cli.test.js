import path from 'path';
import fs from 'fs';
import util from 'util';
import childProcess from 'child_process';
import stripAnsi from 'strip-ansi';

const exec = util.promisify(childProcess.exec);

describe('@dbml/cli', () => {
  const runTest = async (dirName, binFile) => {
    process.chdir(dirName);
    const args = [path.join(__dirname, binFile)];
    const optsRaw = fs.readFileSync(path.join(dirName, './options.json'), 'utf-8');
    const opts = JSON.parse(optsRaw);
    args.push(...opts.args);

    const isOutFile = fs.existsSync(path.join(dirName, './expect-out-files'));
    if (isOutFile && !fs.existsSync(path.join(dirName, './out-files'))) {
      fs.mkdirSync(path.join(dirName, './out-files'));
    }

    const { stdout } = await exec(`node ${args.join(' ')}`);
    const expectStdout = fs.readFileSync(path.join(dirName, './stdout.txt'), 'utf-8');
    const actualStdout = stripAnsi(stdout);

    // folder name contains `syntax-error`
    if (path.basename(dirName).includes('syntax-error')) {
      expect(actualStdout).toContain(expectStdout);
    } else {
      expect(actualStdout).toBe(expectStdout);
    }

    if (isOutFile) {
      const fileNames = fs.readdirSync(path.join(dirName, './out-files'));
      let content = fs.readFileSync(path.join(dirName, './out-files', fileNames[0]), 'utf-8');
      if (binFile === '../bin/dbml2sql.js') content = content.replace(/--.*(?:\n)*/g, '');

      content = content.replaceAll('\r\n', '\n');
      const expectContent = fs.readFileSync(path.join(dirName, './expect-out-files', fileNames[0]), 'utf-8');
      expect(content).toBe(expectContent);
    }
  };

  /* eslint-disable */
  test.each(scanDirNames(__dirname, 'dbml2sql'))('dbml2sql/%s', async (dirName) => {
    await runTest(path.join(__dirname, 'dbml2sql', dirName), '../bin/dbml2sql.js');
  }, 10000);

  test.each(scanDirNames(__dirname, 'sql2dbml'))('sql2dbml/%s', async (dirName) => {
    await runTest(path.join(__dirname, 'sql2dbml', dirName), '../bin/sql2dbml.js');
  }, 10000);

  test.each(scanDirNames(__dirname, 'db2dbml'))('db2dbml/%s', async (dirName) => {
    await runTest(path.join(__dirname, 'db2dbml', dirName), '../bin/db2dbml.js');
  }, 10000);
  /* eslint-enable */
});
