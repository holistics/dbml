import antlr4 from 'antlr4';

/* Based on Oracle base class: https://github.com/mysql/mysql-workbench/blob/8.0/library/parsers/mysql/MySQLBaseLexer.h */

export default class MySQLBaseLexer extends antlr4.Lexer {
  constructor (input) {
    super(input);
  }

  // https://www.antlr.org/api/Java/org/antlr/v4/runtime/Lexer.html#setType(int)
  setType (val) {
    console.log(2, this);
    this.type = val;
  }
}
