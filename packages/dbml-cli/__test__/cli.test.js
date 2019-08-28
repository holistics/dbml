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

    const { stdout } = await exec(`${process.execPath} ${args.join(' ')}`);
    const expectStdout = fs.readFileSync(path.join(dirName, './stdout.txt'), 'utf-8');

    const actualStdout = stripAnsi(stdout);

    expect(actualStdout).toBe(expectStdout);

    if (isOutFile) {
      const fileNames = fs.readdirSync(path.join(dirName, './out-files'));
      let content = fs.readFileSync(path.join(dirName, './out-files', fileNames[0]), 'utf-8');
      content = content.replace(/--.*(?:\n)*/g, '');
      const expectContent = fs.readFileSync(path.join(dirName, './expect-out-files', fileNames[0]), 'utf-8');
      expect(content).toBe(expectContent);
    }
  };

  /* eslint-disable */
  test.each(scanDirNames(__dirname, 'dbml2sql'))('dbml2sql/%s', async (dirName) => {
    await runTest(path.join(__dirname, 'dbml2sql', dirName), 'dbml2sql_bin.js');
  });

  test.each(scanDirNames(__dirname, 'sql2dbml'))('sql2dbml/%s', async (dirName) => {
    await runTest(path.join(__dirname, 'sql2dbml', dirName), 'sql2dbml_bin.js');
  });
  /* eslint-enable */
});
