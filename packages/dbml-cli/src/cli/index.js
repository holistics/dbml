import program from 'commander';
import importHandler from './import';
import exportHandler from './export';
import connectionHandler from './connector';
import projectInfo from '../../package.json';

function dbml2sql (args) {
  program.version(projectInfo.version);

  program
    .usage('[options] <files...>')
    .option('--mysql')
    .option('--postgres')
    .option('--mssql')
    .option('--oracle')
    .option('-o, --out-file <pathspec>', 'compile all input files into a single files');
  // .option('-d, --out-dir <pathspec>', 'compile an input directory of dbml files into an output directory');

  program.parse(args);

  exportHandler(program);
}

function sql2dbml (args) {
  program.version(projectInfo.version);

  program
    .usage('[options] <files...>')
    .option('--mysql')
    .option('--mysql-legacy')
    .option('--postgres')
    .option('--postgres-legacy')
    .option('--mssql')
    .option('--snowflake')
    .option('-o, --out-file <pathspec>', 'compile all input files into a single files');
  // .option('-d, --out-dir <pathspec>', 'compile an input directory of sql files into an output directory');

  program.parse(args);

  importHandler(program);
}

function db2dbml (args) {
  program.version(projectInfo.version);

  program
    .usage('<connection-string> [options]')
    .arguments('database connection string')
    .option('--postgres', 'connect to a postgresql database')
    .option('--mysql', 'connect to a mysql database')
    .option('-o, --out-file <pathspec>', 'compile all input files into a single files');

  program.parse(args);

  connectionHandler(program);
}

export {
  dbml2sql,
  sql2dbml,
  db2dbml,
};
