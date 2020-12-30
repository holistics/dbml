import Database, { RawDatabase } from '../model_structure/database';
declare class Parser {
    static parseJSONToDatabase(rawDatabase: RawDatabase): Database;
    static parseMySQLToJSON(str: string): RawDatabase;
    static parsePostgresToJSON(str: string): RawDatabase;
    static parseDBMLToJSON(str: string): RawDatabase;
    static parseSchemaRbToJSON(str: string): RawDatabase;
    static parseMSSQLToJSON(str: string): RawDatabase;
    static parse(str: string, format: 'mysql' | 'postgres' | 'dbml' | 'schemarb' | 'mssql' | 'json'): Database;
}
export default Parser;
