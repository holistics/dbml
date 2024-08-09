import { parseSqlConnectionString } from '@tediousjs/connection-string';

const parseConnStr = (connectionString) => {
  return parseSqlConnectionString(connectionString, true);
};

export {
  parseConnStr,
};
