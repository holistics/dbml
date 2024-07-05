import fs from 'fs'; // TODO: Remove this line after development is done
import importer from '../../src/import';

// TODO: Remove this function after development is done
const writeFile = (filePath, data) => {
  fs.writeFileSync(filePath, data, (err) => {
    if (err) console.error(err);
    console.log('File has been created successfully');
  });
};




describe('@dbml/core - importer', () => {
  /**
   * @param {string} format = [json|mysql|postgres]
   */
  const runTest = (fileName, testDir, format) => {
    /* eslint-disable */
    const fileExtension = getFileExtension(format);
    const input = require(`./${testDir}/input/${fileName}.in.${fileExtension}`);
    const output = require(`./${testDir}/output/${fileName}.out.dbml`);

    const res = importer.import(input, format);

    // TODO: Remove this block after development is done
    const filePath = './snowflake_test.dbml';
    writeFile(filePath, res);

    expect(res).toBe(output);
    /* eslint-enable */
  };

  /* eslint-disable */
  // test.each(scanTestNames(__dirname, 'json_importer/input'))('json_importer/%s', (name) => {
  //   runTest(name, 'json_importer', 'json');
  // });

  // test.each(scanTestNames(__dirname, 'mysql_importer/input'))('mysql_importer/%s', (name) => {
  //   runTest(name, 'mysql_importer', 'mysql');
  // });

  // test.each(scanTestNames(__dirname, 'postgres_importer/input'))('postgres_importer/%s', (name) => {
  //   runTest(name, 'postgres_importer', 'postgres');
  // });

  // test.each(scanTestNames(__dirname, 'mssql_importer/input'))('mssql_importer/%s', (name) => {
  //   runTest(name, 'mssql_importer', 'mssql');
  // });

  // test.each(scanTestNames(__dirname, 'snowflake_importer/input'))('snowflake_importer/%s', (name) => {
  //   runTest(name, 'snowflake_importer', 'snowflake');
  // });

  const testName = '01_full_ddl';
  test(testName, () => {
    runTest(testName, 'snowflake_importer', 'snowflake');
  });
  /* eslint-enable */
});
