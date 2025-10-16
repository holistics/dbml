const fs = require('fs');
const path = require('path');

// Use the built version
const Parser = require('./lib/parse/Parser').default;

const inputFile = path.join(__dirname, '__tests__/parser/mssql-parse/input/check_constraints.in.sql');
const sql = fs.readFileSync(inputFile, 'utf8');

console.log('=== INPUT SQL ===');
console.log(sql);
console.log('\n=== PARSING ===');

try {
  const result = Parser.parseMSSQLToJSONv2(sql);
  console.log('\n=== SUCCESS ===');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('\n=== ERROR ===');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  if (error.errors) {
    console.error('Parse errors:', JSON.stringify(error.errors, null, 2));
  }
}
