import antlr4 from 'antlr4';
import SyntaxError from './SyntaxError';

export default class ParserErrorListener extends antlr4.error.ErrorListener {
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  syntaxError (recognizer, offendingSymbol, line, column, msg, err) {
    throw new SyntaxError(line, column, msg);
  }
}
