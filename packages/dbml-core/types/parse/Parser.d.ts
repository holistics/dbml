import { Compiler } from '@dbml/parse';
import Database, { RawDatabase } from '../model_structure/database';

declare type ParseFormat = 'json'
    | 'mysql' | 'mysqlLegacy'
    | 'postgres' | 'postgresLegacy'
    | 'dbml' | 'dbmlv2'
    | 'mssql' | 'mssqlLegacy'
    | 'schemarb'
    | 'snowflake';

declare class Parser {
    public DBMLCompiler: Compiler;
    constructor(dbmlCompiler?: Compiler);
    static parseJSONToDatabase(rawDatabase: RawDatabase): Database;
    static parseMySQLToJSON(str: string): RawDatabase;
    static parseMySQLToJSONv2(str: string): RawDatabase;
    static parsePostgresToJSON(str: string): RawDatabase;
    static parsePostgresToJSONv2(str: string): RawDatabase;
    static parseDBMLToJSON(str: string): RawDatabase;
    static parseDBMLToJSONv2(str: string, dbmlCompiler?: Compiler): RawDatabase;
    static parseSchemaRbToJSON(str: string): RawDatabase;
    static parseMSSQLToJSON(str: string): RawDatabase;
    static parseMSSQLToJSONv2(str: string): RawDatabase;
    static parseSnowflakeToJSON(str: string): RawDatabase;
    /**
     * Should use parse() instance method instead of this static method whenever possible
     */
    static parse(str: string, format: ParseFormat): Database;
    static parse(str: RawDatabase, format: 'json'): Database;
    parse(str: string, format: ParseFormat): Database;
    parse(str: RawDatabase, format: 'json'): Database;
}
export default Parser;
