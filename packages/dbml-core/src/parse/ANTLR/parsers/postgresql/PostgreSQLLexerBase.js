import antlr4 from 'antlr4';

export default class PostgreSQLLexerBase extends antlr4.Lexer {
  constructor (input) {
    super(input);
  }
}

// helper function required by the generated grammar
// To avoid error, we decleare their signature and import them in the generated PostgreSQLLexer.js
// original (C#): https://github.com/antlr/grammars-v4/blob/master/sql/postgresql/CSharp/PostgreSQLLexerBase.cs
export function checkLA () {
}

export function HandleLessLessGreaterGreater () {
}

export function pushTag () {
}

export function isTag () {
}
