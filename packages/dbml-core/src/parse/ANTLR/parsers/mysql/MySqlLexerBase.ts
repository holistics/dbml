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

  nextToken () {
    // See the comment above HIGH_PRIORITY_MODE in the Lexer grammar G4 file
    this.setMode(MySqlLexerBase.DEFAULT_MODE); // always start in DEFAULT_MODE, which will automatically switch to high priority mode
    return super.nextToken();
  }
}
