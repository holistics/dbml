// import fs from 'fs'; // Toggle comment of this line to right parsed result to file
import importer from '../../src/import';

// Toggle comment for this block to write parsed result to file
// const writeFile = (filePath, data) => {
//   fs.writeFileSync(filePath, data, (err) => {
//     if (err) console.error(err);
//     console.log('File has been created successfully');
//   });
// };

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

    // Toggle comment of this block to write parsed result to file
    // const filePath = './snowflake_test.dbml';
    // writeFile(filePath, res);

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

  test.each(scanTestNames(__dirname, 'snowflake_importer/input'))('snowflake_importer/%s', (name) => {
    runTest(name, 'snowflake_importer', 'snowflake');
  });

  // const testNames = [
  //   'alter',
  //   'comment',
  //   'at_before',
  //   'create',
  //   'create_table',
  //   'dml',
  //   'general_schema',
  //   'ids',
  //   'tables',
  // ];
  // testNames.forEach((name) => {
  //   test(name, () => {
  //     runTest(name, 'snowflake_importer', 'snowflake');
  //   });
  // });
  /* eslint-enable */
});
