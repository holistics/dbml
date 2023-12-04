/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */
import antlr4 from 'antlr4';
import PostgreSQLLexer from '../parsers/postgresql/PostgreSQLLexer';
import PostgreSQLParser from '../parsers/postgresql/PostgreSQLParser';
import PostgresASTGen from './postgres/PostgresASTGen';

import MySQLLexer from '../parsers/mysql/MySQLLexer';
import MySQLParser from '../parsers/mysql/MySQLParser';
import MySQLASTGen from './mysql/MySQLASTGen';

import ParserErrorListener from './ParserErrorListener';

export function parse (input, format) {
  const chars = new antlr4.InputStream(input);
  let database = null;

  switch (format) {
    case 'postgres': {
      const lexer = new PostgreSQLLexer(chars);
      const tokens = new antlr4.CommonTokenStream(lexer);
      const parser = new PostgreSQLParser(tokens);
      parser.buildParseTrees = true;
      parser.removeErrorListeners();
      parser.addErrorListener(new ParserErrorListener());

      const parseTree = parser.root();

      database = parseTree.accept(new PostgresASTGen());
      break;
    }
    case 'mysql': {
      const lexer = new MySQLLexer(chars);
      const tokens = new antlr4.CommonTokenStream(lexer);
      const parser = new MySQLParser(tokens);
      parser.buildParseTrees = true;
      parser.removeErrorListeners();
      parser.addErrorListener(new ParserErrorListener());

      const parseTree = parser.query();

      database = parseTree.accept(new MySQLASTGen());
      break;
    }
    default:
      throw new Error(`Format not supported: ${format}`);
  }

  return database;
}
