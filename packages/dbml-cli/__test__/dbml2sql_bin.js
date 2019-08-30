// eslint-disable-next-line
require = require('esm')(module);
const { dbml2sql } = require('../src');

dbml2sql(process.argv);
