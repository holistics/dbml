/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */
import antlr4 from 'antlr4';
import PostgreSQLLexer from '../parsers/postgresql/PostgreSQLLexer';
import PostgreSQLParser from '../parsers/postgresql/PostgreSQLParser';
import PostgresASTGen from './PostgresASTGen';

export function parse (input, format) {
  const chars = new antlr4.InputStream(input);
  let database = null;

  if (format === 'postgres') {
    const lexer = new PostgreSQLLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new PostgreSQLParser(tokens);
    parser.buildParseTrees = true;

    const parseTree = parser.root();

    database = parseTree.accept(new PostgresASTGen());
  } else {
    throw new Error(`Format not supported: ${format}`);
  }

  return database;
}
