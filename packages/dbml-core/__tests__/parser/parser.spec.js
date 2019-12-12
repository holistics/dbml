import Parser from '../../src/parse/Parser';

describe('@dbml/core - parser', () => {
  const parser = new Parser();

  /**
   * @param {string} format = [json|mysql|postgres|dbml|schemarb]
   */
  const runTest = (fileName, testDir, format, parseFuncName) => {
    /* eslint-disable */
    const fileExtension = getFileExtension(format);
    const input = require(`./${testDir}/input/${fileName}.in.${fileExtension}`);
    const output = require(`./${testDir}/output/${fileName}.out.json`);
    const jsonSchema = parser[parseFuncName](input);

    isEqualExcludeTokenEmpty(jsonSchema, output);
    /* eslint-enable */
  };

  /* eslint-disable */
  test.each(scanTestNames(__dirname, 'dbml_parse/input'))('dbml_parse/%s', (name) => {
    runTest(name, 'dbml_parse', 'dbml', 'parseDBMLToJSON');
  });

  test.each(scanTestNames(__dirname, 'mysql_parse/input'))('mysql_parse/%s', (name) => {
    runTest(name, 'mysql_parse', 'mysql', 'parseMySQLToJSON');
  });

  test.each(scanTestNames(__dirname, 'postgres_parse/input'))('postgres_parse/%s', (name) => {
    runTest(name, 'postgres_parse', 'postgres', 'parsePostgresToJSON');
  });

  test.each(scanTestNames(__dirname, 'schemarb_parse/input'))('schemarb_parse/%s', (name) => {
    runTest(name, 'schemarb_parse', 'schemarb', 'parseSchemaRbToJSON');
  });
  /* eslint-enable */
});
