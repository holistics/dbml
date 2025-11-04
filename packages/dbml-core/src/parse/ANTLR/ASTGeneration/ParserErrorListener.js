import antlr4 from 'antlr4';
import SyntaxError from './SyntaxError';

export default class ParserErrorListener extends antlr4.error.ErrorListener {
  constructor (args) {
    super(args);

    /** @type {SyntaxError[]} */
    this.errors = [];
  }

  syntaxError (recognizer, offendingSymbol, line, column, msg, err) {
    this.errors.push(new SyntaxError(line, column, msg));
  }
}
