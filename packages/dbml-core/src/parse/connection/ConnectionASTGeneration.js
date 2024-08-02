import PostgresConnectionASTGen from './postgres/PostgresConnectionASTGen';
import MySQLConnectionASTGen from './mysql/MySQLConnectionASTGen';

function fetchSchema (connection, format) {
  let database = null;

  switch (format) {
    case 'postgres': {
      database = new PostgresConnectionASTGen().fetchSchema(connection);

      break;
    }
    case 'mysql': {
      database = new MySQLConnectionASTGen().fetchSchema(connection);
      break;
    }
    default:
      throw new Error(`Format not supported: ${format}`);
  }
  return database;
}

export {
  fetchSchema,
};
