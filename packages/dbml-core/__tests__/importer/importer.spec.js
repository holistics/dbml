import importer from '../../src/import';

describe('@dbml/core', () => {
  describe('importer', () => {
    /**
     * @param {string} format = [json|mysql|postgres]
     */
    const runTest = (fileName, testDir, format) => {
      /* eslint-disable */
      const fileExtension = getFileExtension(format);
      const input = require(`./${testDir}/input/${fileName}.in.${fileExtension}`);
      const output = require(`./${testDir}/output/${fileName}.out.dbml`);
      const res = importer.import(input, format);

      expect(res).toBe(output);
      /* eslint-enable */
    };

    /* eslint-disable */
    test.each(scanTestNames(__dirname, 'json-importer/input'))('json-importer/%s', (name) => {
      runTest(name, 'json-importer', 'json');
    });

    test.each(scanTestNames(__dirname, 'mysql-importer/input'))('mysql-importer/%s', (name) => {
      runTest(name, 'mysql-importer', 'mysql');
    });

    test.each(scanTestNames(__dirname, 'postgres-importer/input'))('postgres-importer/%s', (name) => {
      runTest(name, 'postgres-importer', 'postgres');
    });
    /* eslint-enable */
  });
});
