import antlr4 from 'antlr4';

// Original (C#): https://github.com/antlr/grammars-v4/blob/master/sql/postgresql/CSharp/PostgreSQLLexerBase.cs
// Base class required by the generated parser
export default class PostgreSQLParserBase extends antlr4.Parser {
}

// helper function required by the generated grammar, these were called implicitly without the 'this.' keyword
// In C#, these can be decleare as base classes's methods, this won't work is JS.
// To avoid error, we declare their signature and import them in the generated PostgreSQLParser.js
export function ParseRoutineBody () {
}
