import program from 'commander';
import importHandler from './import';
import exportHandler from './export';
import connectionHandler from './connector';
import projectInfo from '../../package.json';

function showHelp (args) {
  if (args.length < 3) program.help();
}

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

  showHelp(args);
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

  showHelp(args);
  program.parse(args);

  importHandler(program);
}

function db2dbml (args) {
  program.version(projectInfo.version);

  const description = `Generate DBML directly from a database
    <format>            your database format (postgres, mysql, mssql, bigquery)
    <connection-string> your database connection string or path to credential file:
                        - postgres: postgresql://user:password@localhost:5432/dbname
                        - mysql: mysql://user:password@localhost:3306/dbname
                        - mssql: 'Server=localhost,1433;Database=master;User Id=sa;Password=your_password;Encrypt=true;TrustServerCertificate=true;'
                        - bigquery: /path_to_json_credential.json

                        For BigQuery, your JSON credential file must contain the following keys:
                          {
                            "project_id": "your-project-id",
                            "client_email": "your-client-email",
                            "private_key": "your-private-key",
                            "datasets": ["dataset_1", "dataset_2", ...]
                          }

                        Note: If the "datasets" key is not provided or is an empty array, it will fetch information from all datasets.
  `;
  program
    .usage('<format> <connection-string> [options]')
    .description(description)
    .option('-o, --out-file <pathspec>', 'compile all input files into a single files');

  showHelp(args);
  program.parse(args);

  connectionHandler(program);
}

export {
  dbml2sql,
  sql2dbml,
  db2dbml,
};
