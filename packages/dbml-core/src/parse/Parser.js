import {
  Compiler, DEFAULT_ENTRY, Filepath, MemoryProjectLayout,
} from '@dbml/parse';
import Database from '../model_structure/database';
import { parse } from './sql';
import * as schemarbParser from './schemarb/parser.js';
import { CompilerError } from './error';

class Parser {
  constructor () {
    this.layout = new MemoryProjectLayout();
    this.DBMLCompiler = new Compiler(this.layout);
  }

  static parseJSONToDatabase (rawDatabase, { overrideCardinality = false } = {}) {
    const database = new Database(rawDatabase);
    if (overrideCardinality) database.adjustCardinalitiesFromColumns();
    return database;
  }

  static parseMySQLToJSONv2 (str) {
    return parse(str, 'mysql');
  }

  static parsePostgresToJSONv2 (str) {
    return parse(str, 'postgres');
  }

  static parseDBMLToJSONv2 (str) {
    const layout = new MemoryProjectLayout();
    layout.setSource(DEFAULT_ENTRY, str);
    const compiler = new Compiler(layout);

    const diags = convertDbmlParserError(compiler.parse.errors(DEFAULT_ENTRY));
    if (diags.length > 0) throw CompilerError.create(diags);

    return compiler.parse.rawDb(DEFAULT_ENTRY);
  }

  static parseSchemaRbToJSON (str) {
    return schemarbParser.parse(str);
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

  getDbmlSource (filepath) {
    filepath = typeof filepath === 'string' ? Filepath.from(filepath) : filepath;
    return this.layout.getSource(filepath);
  }

  setDbmlSource (filepath, source) {
    filepath = typeof filepath === 'string' ? Filepath.from(filepath) : filepath;
    if (source === undefined) {
      this.layout.deleteSource(filepath);
    } else {
      this.layout.setSource(filepath, source);
    }
  }

  deleteDbmlSource (filepath) {
    filepath = typeof filepath === 'string' ? Filepath.from(filepath) : filepath;
    this.layout.deleteSource(filepath);
  }

  clearDbmlSource () {
    this.layout.clearSource();
  }

  parseDbmlProject (entrypoint) {
    entrypoint = typeof entrypoint === 'string' ? Filepath.from(entrypoint) : entrypoint;
    const result = this.DBMLCompiler.interpretFile(entrypoint);
    const diags = convertDbmlParserError(result.getErrors());
    if (diags.length > 0) throw CompilerError.create(diags);

    return Parser.parseJSONToDatabase(result.getValue() || {});
  }

  parse (str, format) {
    try {
      let rawDatabase = {};
      let overrideCardinality = false;
      switch (format) {
        case 'mysql':
          rawDatabase = Parser.parseMySQLToJSONv2(str);
          overrideCardinality = true;
          break;

        case 'postgres':
          rawDatabase = Parser.parsePostgresToJSONv2(str);
          overrideCardinality = true;
          break;

        case 'snowflake':
          rawDatabase = Parser.parseSnowflakeToJSON(str);
          overrideCardinality = true;
          break;

        case 'dbmlv2':
          rawDatabase = Parser.parseDBMLToJSONv2(str);
          break;

        case 'schemarb':
          rawDatabase = Parser.parseSchemaRbToJSON(str);
          overrideCardinality = true;
          break;

        case 'mssql':
          rawDatabase = Parser.parseMSSQLToJSONv2(str);
          overrideCardinality = true;
          break;

        case 'oracle':
          rawDatabase = Parser.parseOracleToJSON(str);
          overrideCardinality = true;
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

      const schema = Parser.parseJSONToDatabase(rawDatabase, { overrideCardinality });
      return schema;
    } catch (diags) {
      throw CompilerError.create(diags);
    }
  }
}

export default Parser;

function convertDbmlParserError (diags) {
  return diags.map((error) => ({
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
}
