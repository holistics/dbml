// eslint-disable-next-line
require = require('esm')(module);
const { db2dbml } = require('../src');

db2dbml(process.argv);
