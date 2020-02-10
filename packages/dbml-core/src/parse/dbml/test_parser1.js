const fs = require('fs');

const pegjsRequire = require('pegjs-require-import');
const parser = pegjsRequire('./parser.pegjs', {
  format: 'commonjs',
  dependencies: {
    _: 'lodash'
  }
});

const content = fs.readFileSync('src/parse/dbml/parser1_content.txt', 'utf-8');
const res = parser.parse(content);
fs.writeFileSync('src/parse/dbml/parser1.json', JSON.stringify(res, null, 2));

console.log(res);
