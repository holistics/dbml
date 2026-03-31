import { Compiler, type DbmlProjectLayout, type Filepath } from '@dbml/parse';
import Database from '../model_structure/database';
import { parse } from './ANTLR/ASTGeneration';
import { CompilerError } from './error';
import mysqlParser from './deprecated/mysqlParser.cjs';
import postgresParser from './deprecated/postgresParser.cjs';
import dbmlParser from './deprecated/dbmlParser.cjs';
import schemarbParser from './deprecated/schemarbParser.cjs';
import mssqlParser from './deprecated/mssqlParser.cjs';

type ParseFormat = 'json'
  | 'mysql' | 'mysqlLegacy'
  | 'postgres' | 'postgresLegacy'
  | 'dbml' | 'dbmlv2'
  | 'mssql' | 'mssqlLegacy'
  | 'schemarb'
  | 'snowflake'
  | 'oracle';

type ProjectFormat = 'dbmlv2';

class Parser {
  DBMLCompiler: Compiler;

  constructor (dbmlCompiler?: Compiler) {
    this.DBMLCompiler = dbmlCompiler || new Compiler();
  }

  static parseJSONToDatabase (rawDatabase: any): Database {
    return new Database(rawDatabase);
  }

  static parseMySQLToJSONv2 (str: string) {
    return parse(str, 'mysql');
  }

  /** @deprecated Use `parseMySQLToJSONv2` instead */
  static parseMySQLToJSON (str: string) {
    return mysqlParser.parse(str);
  }

  static parsePostgresToJSONv2 (str: string) {
    return parse(str, 'postgres');
  }

  /** @deprecated Use `parsePostgresToJSONv2` instead */
  static parsePostgresToJSON (str: string) {
    return postgresParser.parse(str);
  }

  static parseDBMLToJSONv2 (str: string, dbmlCompiler?: Compiler) {
    const compiler = dbmlCompiler || new Compiler();
    compiler.setSource(str);

    const diags = compiler.parse.errors().map((error: any) => ({
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

    return compiler.parse.rawDb();
  }

  /** @deprecated Use `parseDBMLToJSONv2` instead */
  static parseDBMLToJSON (str: string) {
    return dbmlParser.parse(str);
  }

  static parseSchemaRbToJSON (str: string) {
    return schemarbParser.parse(str);
  }

  /** @deprecated Use `parseMSSQLToJSONv2` instead */
  static parseMSSQLToJSON (str: string) {
    return mssqlParser.parseWithPegError(str);
  }

  static parseMSSQLToJSONv2 (str: string) {
    return parse(str, 'mssql');
  }

  static parseSnowflakeToJSON (str: string) {
    return parse(str, 'snowflake');
  }

  static parseOracleToJSON (str: string) {
    return parse(str, 'oracle');
  }

  static parse (str: string | object, format: ParseFormat): Database {
    return new Parser().parse(str, format);
  }

  static parseProject (layout: DbmlProjectLayout, entrypoint: Filepath, format: ProjectFormat = 'dbmlv2'): Database {
    switch (format) {
      case 'dbmlv2':
        return Parser.parseDbmlv2Project(layout, entrypoint);
      default:
        throw new Error(`Unsupported project format: ${options.format}`);
    }
  }

  private static parseDbmlv2Project (layout: DbmlProjectLayout, entrypoint: Filepath): Database {
    const compiler = new Compiler(layout);

    const report = compiler.interpretFile(entrypoint);

    const diags = report.getErrors().map((error: any) => ({
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

    return new Database({ ...report.getValue(), dbState: undefined });
  }

  parse (str: string | object, format: ParseFormat): Database {
    try {
      let rawDatabase: any = {};
      switch (format) {
        case 'mysql':
          rawDatabase = Parser.parseMySQLToJSONv2(str as string);
          break;

        case 'mysqlLegacy':
          rawDatabase = Parser.parseMySQLToJSON(str as string);
          break;

        case 'postgres':
          rawDatabase = Parser.parsePostgresToJSONv2(str as string);
          break;

        case 'snowflake':
          rawDatabase = Parser.parseSnowflakeToJSON(str as string);
          break;

        case 'postgresLegacy':
          rawDatabase = Parser.parsePostgresToJSON(str as string);
          break;

        case 'dbml':
          rawDatabase = Parser.parseDBMLToJSON(str as string);
          break;

        case 'dbmlv2':
          rawDatabase = Parser.parseDBMLToJSONv2(str as string, this.DBMLCompiler);
          break;

        case 'schemarb':
          rawDatabase = Parser.parseSchemaRbToJSON(str as string);
          break;

        case 'mssqlLegacy':
          rawDatabase = Parser.parseMSSQLToJSON(str as string);
          break;

        case 'mssql':
          rawDatabase = Parser.parseMSSQLToJSONv2(str as string);
          break;

        case 'oracle':
          rawDatabase = Parser.parseOracleToJSON(str as string);
          break;

        case 'json':
          if (typeof str === 'object') {
            rawDatabase = str;
          } else {
            rawDatabase = JSON.parse(str as string);
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
export type { ParseFormat, ProjectFormat };
