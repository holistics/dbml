const pegRequire = require('pegjs-require-import');
const parser = pegRequire('./parser.pegjs', {
  format: 'commonjs',
  dependencies: {
    _: 'lodash',
  },
});
const content = `
//// -- LEVEL 1
//// -- Tables and References
// Creating tables
Table users as U {
  id int [pk, increment] // auto-increment
  full_name varchar
  created_at timestamp
  country_code int
}
Ref: U.(a,b) < U.b
`;
const result = parser.parse(content);
console.log(result.refs[0].endpoints);