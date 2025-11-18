import antlr4 from 'antlr4';
import MySqlLexer from './MySqlLexer';

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
    const token = super.nextToken();
    const newMode = this._mode;
    if (newMode === MySqlLexer.LOW_PRIORITY_MODE) {
      // If we're just extracting a low-priority token
      // Then return back to high priority mode
      this.mode(MySqlLexer.HIGH_PRIORITY_MODE);
    }
    return token;
  }
}
