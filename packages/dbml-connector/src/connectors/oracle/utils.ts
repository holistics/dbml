import oracledb from 'oracledb';

export const LIST_SEPARATOR = '@@@@@@@@'; // Used to join multiple fields into a string field to simulate array column types

export const EXECUTE_OPTIONS = { outFormat: oracledb.OUT_FORMAT_OBJECT };
