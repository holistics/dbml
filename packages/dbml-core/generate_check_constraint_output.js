const fs = require('fs');
const path = require('path');
const Parser = require('./lib/parse/Parser').default;

const inputFile = path.join(__dirname, '__tests__/parser/mssql-parse/input/check_constraints.in.sql');
const outputFile = path.join(__dirname, '__tests__/parser/mssql-parse/output/check_constraints.out.json');

const sql = fs.readFileSync(inputFile, 'utf8');

try {
  const result = Parser.parseMSSQLToJSONv2(sql);
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2) + '\n');
  console.log('Successfully generated output file!');
  console.log('Output written to:', outputFile);
} catch (error) {
  console.error('Error parsing SQL:', error);
  process.exit(1);
}
