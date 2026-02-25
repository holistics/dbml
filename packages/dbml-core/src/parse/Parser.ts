import { Compiler } from '@dbml/parse';
import Database from '../model_structure/database';
import { RawDatabase } from '../model_structure/database';
import { parse } from './ANTLR/ASTGeneration';
import { CompilerError } from './error';
import mysqlParser from './deprecated/mysqlParser.cjs';
import postgresParser from './deprecated/postgresParser.cjs';
import dbmlParser from './deprecated/dbmlParser.cjs';
import schemarbParser from './deprecated/schemarbParser.cjs';
import mssqlParser from './deprecated/mssqlParser.cjs';

export type ParseFormat = 'json'
  | 'mysql' | 'mysqlLegacy'
  | 'postgres' | 'postgresLegacy'
  | 'dbml' | 'dbmlv2'
  | 'mssql' | 'mssqlLegacy'
  | 'schemarb'
  | 'snowflake'
  | 'oracle';

class Parser {
  public DBMLCompiler: Compiler;

  constructor (dbmlCompiler?: Compiler) {
    this.DBMLCompiler = dbmlCompiler || new Compiler();
  }

  static parseJSONToDatabase (rawDatabase: RawDatabase): Database {
    const database = new Database(rawDatabase);
    return database;
  }

  static parseMySQLToJSONv2 (str: string): RawDatabase {
    return parse(str, 'mysql');
  }

  /**
   * @deprecated Use the `parseMySQLToJSONv2` method instead
   */
  static parseMySQLToJSON (str: string): RawDatabase {
    return mysqlParser.parse(str) as RawDatabase;
  }

  static parsePostgresToJSONv2 (str: string): RawDatabase {
    return parse(str, 'postgres');
  }

  /**
   * @deprecated Use the `parsePostgresToJSONv2` method instead
   */
  static parsePostgresToJSON (str: string): RawDatabase {
    return postgresParser.parse(str) as RawDatabase;
  }

  static parseDBMLToJSONv2 (
    str: string,
    dbmlCompiler?: Compiler,
  ): RawDatabase {
    const compiler = dbmlCompiler || new Compiler();

    compiler.setSource(str);

    const diags = compiler.parse.errors().map((error) => ({
      message: error.diagnostic,
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

    if (diags.length > 0) throw CompilerError.create(diags);

    return compiler.parse.rawDb() as unknown as RawDatabase;
  }

  /**
   * @deprecated Use the `parseDBMLToJSONv2` method instead
   */
  static parseDBMLToJSON (str: string): RawDatabase {
    return dbmlParser.parse(str) as unknown as RawDatabase;
  }

  static parseSchemaRbToJSON (str: string): RawDatabase {
    return schemarbParser.parse(str) as RawDatabase;
  }

  /**
   * @deprecated Use the `parseMSSQLToJSONv2` method instead
   */
  static parseMSSQLToJSON (str: string): RawDatabase {
    return (mssqlParser as any).parseWithPegError(str) as RawDatabase;
  }

  static parseMSSQLToJSONv2 (str: string): RawDatabase {
    return parse(str, 'mssql');
  }

  static parseSnowflakeToJSON (str: string): RawDatabase {
    return parse(str, 'snowflake');
  }

  static parseOracleToJSON (str: string): RawDatabase {
    return parse(str, 'oracle');
  }

  /**
   * Should use parse() instance method instead of this static method whenever possible
   */
  static parse (
    str: string,
    format: ParseFormat,
  ): Database;
  static parse (
    str: RawDatabase,
    format: 'json',
  ): Database;
  static parse (
    str: any,
    format: ParseFormat,
  ): Database {
    return new Parser().parse(str, format);
  }

  parse (
    str: string,
    format: ParseFormat,
  ): Database;
  parse (
    str: RawDatabase,
    format: 'json',
  ): Database;
  parse (
    str: any,
    format: ParseFormat,
  ): Database {
    try {
      let rawDatabase: any = {};
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

        case 'dbmlv2':
          rawDatabase = Parser.parseDBMLToJSONv2(str, this.DBMLCompiler);
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

      const schema = Parser.parseJSONToDatabase(rawDatabase);
      return schema;
    } catch (diags) {
      throw CompilerError.create(diags);
    }
  }
}

export default Parser;
