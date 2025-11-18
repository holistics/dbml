import antlr4 from 'antlr4';

export default class MySqlLexerBase extends antlr4.Lexer {
  constructor (input) {
    super(input);
    this.currentDelimiter = ';';
  }

  setDelimiter (delimiter) {
    this.currentDelimiter = delimiter.trim();
  }

  isCurrentDelimiter (text) {
    return text === this.currentDelimiter;
  }
}
