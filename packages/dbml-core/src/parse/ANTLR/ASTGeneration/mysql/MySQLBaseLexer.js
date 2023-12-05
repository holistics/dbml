import antlr4 from 'antlr4';
import MySQLLexer from '../parsers/mysql/MySQLLexer';

/* Based on Oracle base class: https://github.com/mysql/mysql-workbench/blob/8.0/library/parsers/mysql/MySQLBaseLexer.h */

export default class MySQLBaseLexer extends antlr4.Lexer {
  // https://www.antlr.org/api/Java/org/antlr/v4/runtime/Lexer.html#setType(int)
  setType (val) {
    this.type = val;
  }
}

// https://github.com/mysql/mysql-workbench/blob/6e135fb33942123c57f059139cbd787bea4f3f9b/library/parsers/mysql/MySQLBaseLexer.h#L70
// https://github.com/mysql/mysql-workbench/blob/6e135fb33942123c57f059139cbd787bea4f3f9b/library/parsers/mysql/MySQLBaseLexer.cpp#L1037
export function determineNumericType (text) {
  const long_str = "2147483647";
  const long_len = 10;
  const signed_long_str = "-2147483648";
  const longlong_str = "9223372036854775807";
  const longlong_len = 19;
  const signed_longlong_str = "-9223372036854775808";
  const signed_longlong_len = 19;
  const unsigned_longlong_str = "18446744073709551615";
  const unsigned_longlong_len = 20;

  const length = text.length - 1;
  if (length < long_len) return MySQLLexer.INT_NUMBER;

  const negative = 0;

  if (text[0] === '+') {
    
  }
}
