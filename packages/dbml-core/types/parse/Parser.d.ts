import { Compiler, MemoryProjectLayout } from '@dbml/parse';
import Database, { RawDatabase } from '../model_structure/database';

export declare type ParseFormat = 'json'
    | 'mysql' | 'mysqlLegacy'
    | 'postgres' | 'postgresLegacy'
    | 'dbml' | 'dbmlv2'
    | 'mssql' | 'mssqlLegacy'
    | 'schemarb'
    | 'snowflake'
    | 'oracle';

declare class Parser {
    public layout: MemoryProjectLayout;
    public DBMLCompiler: Compiler;
    constructor();
    static parseJSONToDatabase(rawDatabase: RawDatabase): Database;
    /** @deprecated Use parseMySQLToJSONv2 instead */
    static parseMySQLToJSON(str: string): RawDatabase;
    static parseMySQLToJSONv2(str: string): RawDatabase;
    /** @deprecated Use parsePostgresToJSONv2 instead */
    static parsePostgresToJSON(str: string): RawDatabase;
    static parsePostgresToJSONv2(str: string): RawDatabase;
    /** @deprecated Use parseDBMLToJSONv2 instead */
    static parseDBMLToJSON(str: string): RawDatabase;
    static parseDBMLToJSONv2(str: string): RawDatabase;
    static parseSchemaRbToJSON(str: string): RawDatabase;
    /** @deprecated Use parseMSSQLToJSONv2 instead */
    static parseMSSQLToJSON(str: string): RawDatabase;
    static parseMSSQLToJSONv2(str: string): RawDatabase;
    static parseSnowflakeToJSON(str: string): RawDatabase;
    static parseOracleToJSON(str: string): RawDatabase;
    static parse(str: string, format: ParseFormat): Database;
    static parse(str: RawDatabase, format: 'json'): Database;
    parse(str: string, format: ParseFormat): Database;
    parse(str: RawDatabase, format: 'json'): Database;
}
export default Parser;
