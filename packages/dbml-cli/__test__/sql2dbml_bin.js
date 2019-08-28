
// eslint-disable-next-line
require = require('esm')(module);
const { sql2dbml } = require('../src');

sql2dbml(process.argv);
