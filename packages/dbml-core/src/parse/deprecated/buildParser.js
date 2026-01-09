/**
 * @deprecated This file is deprecated and should not be maintained.
 * The PEG parsers are being replaced by ANTLR-based parsers.
 * Use the v2 parser methods in Parser.js instead.
 */
import pegjsRequire from 'pegjs-require-import';
import Promise from 'bluebird';

import fs from 'fs';
import path from 'path';

Promise.promisifyAll(fs);

async function buildParserFile (source, fileName) {
  return fs.writeFileAsync(path.resolve(__dirname, fileName), source);
}

const options = {
  format: 'commonjs',
  dependencies: {
    _: 'lodash',
    pluralize: 'pluralize',
  },
  output: 'source',
};

const mysqlParserSource = pegjsRequire('./mysql/parser.pegjs', options);
const postgresParserSource = pegjsRequire('./postgresql/parser.pegjs', options);
const dbmlParserSource = pegjsRequire('./dbml/parser.pegjs', options);
const schemarbParserSource = pegjsRequire('./schemarb/parser.pegjs', options);

Promise.all([
  buildParserFile(mysqlParserSource, 'mysqlParser.js'),
  buildParserFile(postgresParserSource, 'postgresParser.js'),
  buildParserFile(dbmlParserSource, 'dbmlParser.js'),
  buildParserFile(schemarbParserSource, 'schemarbParser.js'),
]).then(() => {
  console.log('Build parsers completed!');
}).catch((err) => {
  console.log(err);
});
