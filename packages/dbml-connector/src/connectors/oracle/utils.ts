import oracledb from 'oracledb';

export const LIST_SEPARATOR = '@@@@@@@@'; // Used to join multiple fields into a string field to simulate array column types

export const EXECUTE_OPTIONS = { outFormat: oracledb.OUT_FORMAT_OBJECT };

// Expect an Easy Connect string format: username/password@[//]host[:port][/database]
// Explanation of the format: https://www.orafaq.com/wiki/EZCONNECT
export function processEasyConnectString (connection: string): { username: string; password: string; dbidentifier: string } {
  // Capturing group `username`: a string without the characters `/` `@` `:`
  // Capturing group `password`: a string without the characters `/` `@` `:`
  // Capturing group `dbidentifier`: a string containing the `host[:port][/database]` part
  const matches = connection.match(/^(?<username>[^/@:]+)\/(?<password>[^/@:]+)@(\/\/)?(?<dbidentifier>.+)$/);
  const { username, password, dbidentifier } = matches?.groups || {};
  if (!username || !password || !dbidentifier) {
    throw new Error('Invalid Easy Connect string. Expect a string of format \'username/password@[//]host[:port][/database]\'');
  }
  return {
    username,
    password,
    dbidentifier,
  };
}
