/* eslint-disable import/no-named-as-default-member */
/* eslint-disable import/no-named-as-default */
import antlr4 from 'antlr4';
import PostgreSQLLexer from '../parsers/postgresql/PostgreSQLLexer';
import PostgreSQLParser from '../parsers/postgresql/PostgreSQLParser';
import PostgresASTGen from './postgres/PostgresASTGen';

import MySQLLexer from '../parsers/mysql/MySqlLexer';
import MySQLParser from '../parsers/mysql/MySqlParser';
import MySQLASTGen from './mysql/MySQLASTGen';

import SnowflakeLexer from '../parsers/snowflake/SnowflakeLexer';
import SnowflakeParser from '../parsers/snowflake/SnowflakeParser';
import SnowflakeASTGen from './snowflake/SnowflakeASTGen';

import ParserErrorListener from './ParserErrorListener';

function parse (input, format) {
  const chars = new antlr4.InputStream(input);
  let database = null;

  const errorListener = new ParserErrorListener();

  switch (format) {
    case 'postgres': {
      const lexer = new PostgreSQLLexer(chars);
      const tokens = new antlr4.CommonTokenStream(lexer);
      const parser = new PostgreSQLParser(tokens);
      parser.buildParseTrees = true;
      parser.removeErrorListeners();
      parser.addErrorListener(errorListener);

      const parseTree = parser.root();

      database = parseTree.accept(new PostgresASTGen());

      if (errorListener.errors.length) throw errorListener.errors;
      break;
    }
    case 'mysql': {
      const lexer = new MySQLLexer(chars);
      const tokens = new antlr4.CommonTokenStream(lexer);
      const parser = new MySQLParser(tokens);
      parser.buildParseTrees = true;
      parser.removeErrorListeners();
      parser.addErrorListener(errorListener);

      const parseTree = parser.root();

      database = parseTree.accept(new MySQLASTGen());

      if (errorListener.errors.length) throw errorListener.errors;
      break;
    }
    case 'snowflake': {
      const lexer = new SnowflakeLexer(chars);
      const tokens = new antlr4.CommonTokenStream(lexer);
      const parser = new SnowflakeParser(tokens);
      parser.buildParseTrees = true;
      parser.removeErrorListeners();
      parser.addErrorListener(errorListener);

      const parseTree = parser.snowflake_file();

      database = parseTree.accept(new SnowflakeASTGen());

      if (errorListener.errors.length) throw errorListener.errors;
      break;
    }
    default:
      throw new Error(`Format not supported: ${format}`);
  }

  return database;
}

export {
  parse,
};
