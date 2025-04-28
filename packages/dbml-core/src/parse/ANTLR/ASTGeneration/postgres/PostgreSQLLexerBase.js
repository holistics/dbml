import antlr4 from 'antlr4';

// original (C#): https://github.com/antlr/grammars-v4/blob/master/sql/postgresql/CSharp/PostgreSQLLexerBase.cs
// Base class required by the generated lexer
export default class PostgreSQLLexerBase extends antlr4.Lexer {
}

// helper functions required by the generated grammar, these were called implicitly without the 'this.' keyword
// In C#, these can be decleare as base classes's methods, this won't work in JS.
// To avoid error, we declare their signature and import them in the generated PostgreSQLLexer.js
export function checkLA () {
}

export function HandleLessLessGreaterGreater () {
}

export function pushTag () {
}

export function isTag () {
}

export function charIsLetter () {
}
