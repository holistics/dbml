import exporter from '../../src/export';

describe('@dbml/core', () => {
  describe('exporter', () => {
    /**
     * @param {string} format = [json|mysql|postgres]
     */
    const runTest = (fileName, testDir, format) => {
      /* eslint-disable */
      const fileExtension = getFileExtension(format);
      const input = require(`./${testDir}/input/${fileName}.in.dbml`);
      const output = require(`./${testDir}/output/${fileName}.out.${fileExtension}`);
      const res = exporter.export(input, format);

      expect(res).toBe(output);
      /* eslint-enable */
    };

    /* eslint-disable */
    test.each(scanTestNames(__dirname, 'mysql-exporter/input'))('mysql-exporter/%s', (name) => {
      runTest(name, 'mysql-exporter', 'mysql');
    });

    test.each(scanTestNames(__dirname, 'postgres-exporter/input'))('postgres-exporter/%s', (name) => {
      runTest(name, 'postgres-exporter', 'postgres');
    });
    /* eslint-enable */
  });
});
