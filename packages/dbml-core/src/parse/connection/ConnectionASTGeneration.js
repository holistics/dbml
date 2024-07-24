import PostgresConnectionASTGen from './postgresql/postgresConnectionASTGen';

function fetch (connection, format) {
  let database = null;

  switch (format) {
    case 'postgres': {
      database = new PostgresConnectionASTGen().fetch(connection);

      break;
    }
    default:
      throw new Error(`Format not supported: ${format}`);
  }
  return database;
}

export {
  fetch,
};
