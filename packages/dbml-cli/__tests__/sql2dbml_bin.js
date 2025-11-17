require = require('esm')(module);
const { sql2dbml } = require('../src');

sql2dbml(process.argv);
