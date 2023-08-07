import antlr4 from 'antlr4';

// original (C#): https://github.com/antlr/grammars-v4/blob/master/sql/postgresql/CSharp/PostgreSQLLexerBase.cs
// Base class required by the generated lexer
export default class PostgreSQLLexerBase extends antlr4.Lexer {
  constructor (input) {
    super(input);
  }
}

// helper functions required by the generated grammar
// To avoid error, we decleare their signature and import them in the generated PostgreSQLLexer.js
export function checkLA () {
}

export function HandleLessLessGreaterGreater () {
}

export function pushTag () {
}

export function isTag () {
}
