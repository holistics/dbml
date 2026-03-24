import { Compiler, Filepath, MemoryProjectLayout } from '@dbml/parse';
import Database from '../model_structure/database';
import Model from '../model_structure/model';
import { parse } from './ANTLR/ASTGeneration';
import { CompilerError } from './error';
import mysqlParser from './deprecated/mysqlParser.cjs';
import postgresParser from './deprecated/postgresParser.cjs';
import dbmlParser from './deprecated/dbmlParser.cjs';
import schemarbParser from './deprecated/schemarbParser.cjs';
import mssqlParser from './deprecated/mssqlParser.cjs';

class Parser {
  constructor (dbmlCompiler) {
    this.DBMLCompiler = dbmlCompiler || new Compiler();
  }

  static parseJSONToDatabase (rawDatabase) {
    const database = new Database(rawDatabase);
    return database;
  }

  static parseMySQLToJSONv2 (str) {
    return parse(str, 'mysql');
  }

  /**
   * @deprecated Use the `parseMySQLToJSONv2` method instead
   */
  static parseMySQLToJSON (str) {
    return mysqlParser.parse(str);
  }

  static parsePostgresToJSONv2 (str) {
    return parse(str, 'postgres');
  }

  /**
   * @deprecated Use the `parsePostgresToJSONv2` method instead
   */
  static parsePostgresToJSON (str) {
    return postgresParser.parse(str);
  }

  static parseDBMLToJSONv2 (str, dbmlCompiler) {
    const compiler = dbmlCompiler || new Compiler();
    compiler.setSource(str);
    return Parser._interpretAndThrow(compiler);
  }

  static parseDBMLMultiFile (files, entryPath) {
    const entries = {};
    for (const [filePath, content] of Object.entries(files)) {
      entries[Filepath.from(filePath).intern()] = content;
    }
    const compiler = new Compiler(new MemoryProjectLayout(entries));
    const entry = entryPath ? Filepath.from(entryPath) : undefined;
    return Parser._interpretAndThrow(compiler, entry);
  }

  static _interpretAndThrow (compiler, filepath) {
    const report = compiler.interpretFile(filepath);
    const errors = report.getErrors();

    if (errors.length > 0) {
      const diags = errors.map((error) => ({
        message: error.diagnostic,
        filepath: error.filepath?.absolute,
        location: {
          start: {
            line: error.nodeOrToken.startPos.line + 1,
            column: error.nodeOrToken.startPos.column + 1,
          },
          end: {
            line: error.nodeOrToken.endPos.line + 1,
            column: error.nodeOrToken.endPos.column + 1,
          },
        },
        code: error.code,
      }));
      throw CompilerError.create(diags);
    }

    return report.getValue();
  }

  /**
   * @deprecated Use the `parseDBMLToJSONv2` method instead
   */
  static parseDBMLToJSON (str) {
    return dbmlParser.parse(str);
  }

  static parseSchemaRbToJSON (str) {
    return schemarbParser.parse(str);
  }

  /**
   * @deprecated Use the `parseMSSQLToJSONv2` method instead
   */
  static parseMSSQLToJSON (str) {
    return mssqlParser.parseWithPegError(str);
  }

  static parseMSSQLToJSONv2 (str) {
    return parse(str, 'mssql');
  }

  static parseSnowflakeToJSON (str) {
    return parse(str, 'snowflake');
  }

  static parseOracleToJSON (str) {
    return parse(str, 'oracle');
  }

  static parse (str, format) {
    return new Parser().parse(str, format);
  }

  parse (str, format) {
    try {
      if (format === 'dbmlv2') {
        const model = Parser.parseDBMLToJSONv2(str, this.DBMLCompiler);
        return Parser.parseJSONToDatabase(model.database[0]);
      }

      let rawDatabase = {};
      switch (format) {
        case 'mysql':
          rawDatabase = Parser.parseMySQLToJSONv2(str);
          break;

        case 'mysqlLegacy':
          rawDatabase = Parser.parseMySQLToJSON(str);
          break;

        case 'postgres':
          rawDatabase = Parser.parsePostgresToJSONv2(str);
          break;

        case 'snowflake':
          rawDatabase = Parser.parseSnowflakeToJSON(str);
          break;

        case 'postgresLegacy':
          rawDatabase = Parser.parsePostgresToJSON(str);
          break;

        case 'dbml':
          rawDatabase = Parser.parseDBMLToJSON(str);
          break;

        case 'schemarb':
          rawDatabase = Parser.parseSchemaRbToJSON(str);
          break;

        case 'mssqlLegacy':
          rawDatabase = Parser.parseMSSQLToJSON(str);
          break;

        case 'mssql':
          rawDatabase = Parser.parseMSSQLToJSONv2(str);
          break;

        case 'oracle':
          rawDatabase = Parser.parseOracleToJSON(str);
          break;

        case 'json':
          if (typeof str === 'object') {
            rawDatabase = str;
          } else {
            rawDatabase = JSON.parse(str);
          }
          break;

        default:
          break;
      }

      return Parser.parseJSONToDatabase(rawDatabase);
    } catch (diags) {
      throw CompilerError.create(diags);
    }
  }
}

export default Parser;
