/* eslint-disable max-len */
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
    .option('--sqlite')
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
    .option('--mssql-legacy')
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
    <database-type>     your database format (postgres, mysql, mssql, snowflake, bigquery)
    <connection-string> your database connection string:
                        - postgres: 'postgresql://user:password@localhost:5432/dbname?schemas=schema1,schema2,schema3'
                        - mysql: 'mysql://user:password@localhost:3306/dbname'
                        - mssql: 'Server=localhost,1433;Database=master;User Id=sa;Password=your_password;Encrypt=true;TrustServerCertificate=true;Schemas=schema1,schema2,schema3;'
                        - snowflake:
                          - password-based authentication: 'SERVER=<account_identifier>.<region>;UID=<your_username>;PWD=<your_password>;DATABASE=<your_database>;WAREHOUSE=<your_warehouse>;ROLE=<your_role>;SCHEMAS=schema1,schema2,schema3;'
                          - key pair authentication: 'SERVER=<account_identifier>.<region>;UID=<your_username>;AUTHENTICATOR=SNOWFLAKE_JWT;PRIVATE_KEY_PATH=<path_to_your_private_key.p8>;PASSPHRASE=<your_private_key_passphrase>;DATABASE=<your_database>;WAREHOUSE=<your_warehouse>;ROLE=<your_role>;SCHEMAS=schema1,schema2,schema3;'

                          Note: If you did not use passphrase to encrypt your private key, you can leave the "PASSPHRASE" empty.

                        - bigquery: /path_to_json_credential.json

                        For BigQuery, the credential file supports flexible authentication:

                        1. Application Default Credentials (ADC):
                           - Empty file: {} - uses environment authentication
                           - Override specific fields: {"project_id": "my-project", "datasets": [...]}

                          For more information about ADC, see https://cloud.google.com/docs/authentication/application-default-credentials

                        2. Explicit Service Account (bypasses ADC):
                           {
                             "project_id": "your-project-id",
                             "client_email": "your-client-email",
                             "private_key": "your-private-key",
                             "datasets": ["dataset_1", "dataset_2", ...]
                           }
                           Note: Both client_email and private_key must be provided together.

                        If "datasets" is not specified or is empty, all accessible datasets will be fetched.
  `;
  program
    .usage('<database-type> <connection-string> [options]')
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
