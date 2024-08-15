import { Compiler } from '@dbml/parse';
import Database, { RawDatabase } from '../model_structure/database';
declare class Parser {
    constructor(dbmlCompiler?: Compiler);
    static parseJSONToDatabase(rawDatabase: RawDatabase): Database;
    static parseMySQLToJSON(str: string): RawDatabase;
    static parsePostgresToJSON(str: string): RawDatabase;
    static parsePostgresToJSONv2(str: string): RawDatabase;
    static parseDBMLToJSON(str: string): RawDatabase;
    static parseSchemaRbToJSON(str: string): RawDatabase;
    static parseMSSQLToJSON(str: string): RawDatabase;
    /**
     * Should use parse() instance method instead of this static method whenever possible
     */
    static parse(str: string, format: 'mysql' | 'postgres' | 'dbml' | 'dbmlv2' | 'schemarb' | 'mssql' | 'json'): Database;
    parse(str: string, format: 'mysql' | 'postgres' | 'dbml' | 'dbmlv2' | 'schemarb' | 'mssql' | 'json'): Database;
}
export default Parser;
