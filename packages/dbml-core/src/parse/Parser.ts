import { Compiler, DEFAULT_ENTRY, type DbmlProjectLayout, MemoryProjectLayout, Filepath } from '@dbml/parse';
import Database from '../model_structure/database';
import { parse } from './ANTLR/ASTGeneration';
import { CompilerError } from './error';
import mysqlParser from './deprecated/mysqlParser.cjs';
import postgresParser from './deprecated/postgresParser.cjs';
import dbmlParser from './deprecated/dbmlParser.cjs';
import schemarbParser from './deprecated/schemarbParser.cjs';
import mssqlParser from './deprecated/mssqlParser.cjs';
import { RawDatabase } from '../../types';
import { ParseFormat } from '../../types/parse/Parser';

class Parser {
  DBMLCompiler: Compiler;

  constructor (dbmlCompiler?: Compiler) {
    this.DBMLCompiler = dbmlCompiler || new Compiler();
  }

  static parseJSONToDatabase (rawDatabase: RawDatabase) {
    const database = new Database(rawDatabase);
    return database;
  }

  static parseMySQLToJSONv2 (str: string) {
    return parse(str, 'mysql');
  }

  /**
   * @deprecated Use the `parseMySQLToJSONv2` method instead
   */
  static parseMySQLToJSON (str: string) {
    return mysqlParser.parse(str);
  }

  static parsePostgresToJSONv2 (str: string) {
    return parse(str, 'postgres');
  }

  /**
   * @deprecated Use the `parsePostgresToJSONv2` method instead
   */
  static parsePostgresToJSON (str: string) {
    return postgresParser.parse(str);
  }

  static parseDBMLToJSONv2 (str: string, dbmlCompiler?: Compiler) {
    const compiler = dbmlCompiler || new Compiler();

    compiler.setSource(DEFAULT_ENTRY, str);

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

    return compiler.exportSchemaJson(DEFAULT_ENTRY).getValue();
  }

  /**
   * @deprecated Use the `parseDBMLToJSONv2` method instead
   */
  static parseDBMLToJSON (str: string) {
    return dbmlParser.parse(str);
  }

  static parseSchemaRbToJSON (str: string) {
    return schemarbParser.parse(str);
  }

  /**
   * @deprecated Use the `parseMSSQLToJSONv2` method instead
   */
  static parseMSSQLToJSON (str: string) {
    // @ts-expect-error "Deprecated signature is not type-safe"
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

  static parse (layoutOrStr: string | DbmlProjectLayout, format: ParseFormat) {
    return new Parser().parse(layoutOrStr, format);
  }

  parse (layoutOrStr: string | DbmlProjectLayout, format: ParseFormat): Database {
    try {
      if (typeof layoutOrStr !== 'string' && format !== 'dbmlv2' && format !== 'json') {
        throw new Error('Layout is only supported for dbmlv2 format');
      }

      let rawDatabase: RawDatabase;
      switch (format) {
        case 'mysql':
          rawDatabase = Parser.parseMySQLToJSONv2(layoutOrStr as string);
          break;

        case 'mysqlLegacy':
          // @ts-expect-error "Deprecated functions are not type safe"
          rawDatabase = Parser.parseMySQLToJSON(layoutOrStr as string);
          break;

        case 'postgres':
          rawDatabase = Parser.parsePostgresToJSONv2(layoutOrStr as string);
          break;

        case 'snowflake':
          rawDatabase = Parser.parseSnowflakeToJSON(layoutOrStr as string);
          break;

        case 'postgresLegacy':
          // @ts-expect-error "Deprecated functions are not type safe"
          rawDatabase = Parser.parsePostgresToJSON(layoutOrStr as string);
          break;

        case 'dbml':
          // @ts-expect-error "Deprecated functions are not type safe"
          rawDatabase = Parser.parseDBMLToJSON(layoutOrStr as string);
          break;

        case 'dbmlv2':
          if (typeof layoutOrStr === 'string') {
            // @ts-expect-error "The type definition of @dbml/core's RawDatabase and @dbml/parse's Database have some mismatches"
            rawDatabase = Parser.parseDBMLToJSONv2(layoutOrStr, this.DBMLCompiler);
          } else {
            this.DBMLCompiler.layout = layoutOrStr;
            const diags = this.DBMLCompiler.parse.errors().map((error) => ({
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
            // @ts-expect-error "The type definition of @dbml/core's RawDatabase and @dbml/parse's Database have some mismatches"
            rawDatabase = this.DBMLCompiler.exportSchemaJson(DEFAULT_ENTRY).getValue();
          }
          break;

        case 'schemarb':
          rawDatabase = Parser.parseSchemaRbToJSON(layoutOrStr as string);
          break;

        case 'mssqlLegacy':
          rawDatabase = Parser.parseMSSQLToJSON(layoutOrStr as string);
          break;

        case 'mssql':
          rawDatabase = Parser.parseMSSQLToJSONv2(layoutOrStr as string);
          break;

        case 'oracle':
          rawDatabase = Parser.parseOracleToJSON(layoutOrStr as string);
          break;

        case 'json':
          if (typeof layoutOrStr === 'object') {
            rawDatabase = layoutOrStr as any;
          } else {
            rawDatabase = JSON.parse(layoutOrStr);
          }
          break;

        default:
          throw new Error('Unknown parse format');
      }

      const schema = Parser.parseJSONToDatabase(rawDatabase);
      return schema;
    } catch (diags) {
      throw CompilerError.create(diags);
    }
  }
}

export default Parser;
