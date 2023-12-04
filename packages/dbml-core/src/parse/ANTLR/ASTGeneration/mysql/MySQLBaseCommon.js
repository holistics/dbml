/* eslint-disable no-bitwise */

// SqlMode definition: https://github.com/mysql/mysql-workbench/blob/6e135fb33942123c57f059139cbd787bea4f3f9b/library/parsers/mysql/MySQLRecognizerCommon.h#L51
export const NoMode = 0;
export const AnsiQuotes = 1 << 0;
export const HighNotPrecedence = 1 << 1;
export const PipesAsConcat = 1 << 2;
export const IgnoreSpace = 1 << 3;
export const NoBackslashEscapes = 1 << 4;
// These flags affect parsing behavior. https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html
const sqlMode = NoMode;
// https://github.com/mysql/mysql-workbench/blob/6e135fb33942123c57f059139cbd787bea4f3f9b/library/parsers/mysql/MySQLRecognizerCommon.cpp#L51
export function isSqlModeActive (mode) {
  return (sqlMode & mode) !== 0;
}
