import antlr4 from 'antlr4';

export default class OracleSqlLexerBase extends antlr4.Lexer {
  IsNewlineAtPos (pos) {
    const la = this._input.LA(pos);
    return la === -1 || String.fromCharCode(la) === '\n';
  }
}
