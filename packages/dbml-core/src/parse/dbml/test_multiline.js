const fs = require('fs');

const pegjsRequire = require('pegjs-require-import');
const parser = pegjsRequire('./multiline_string.pegjs', {
  format: 'commonjs',
  dependencies: {
    _: 'lodash'
  }
});

const content = fs.readFileSync('src/parse/dbml/multiline_content.txt', 'utf-8');

let rawStr = parser.parse(content);
console.log(rawStr);

rawStr = rawStr.replace(/\\[\n|\r\n]?/g, '');

let lines = rawStr.split(/[\n|\r\n]/);
console.log(lines);

const leadingSpaces = (str) => {
  let i = 0;
  while (i < str.length && str[i] === ' ') {
    i += 1;
  }
  return i;
}

const minLeadingSpaces = lines.filter(line => line.replace(/\s+/g, '')).reduce((acc, cur) => Math.min(acc, leadingSpaces(cur)), Number.MAX_SAFE_INTEGER);
lines = lines.map(line => line ? line.slice(minLeadingSpaces) : line);

const countLeadingEmptyLine = (lines) => {
  let i = 0;
  while (i < lines.length && !lines[i].replace(/\s+/g, '')) {
    i += 1;
  }
  return i;
}

lines.splice(0, countLeadingEmptyLine(lines));
lines.splice(lines.length - countLeadingEmptyLine(lines.slice().reverse()));

const finalStr = lines.join('\n');

console.log('==========================================================');
console.log(finalStr);