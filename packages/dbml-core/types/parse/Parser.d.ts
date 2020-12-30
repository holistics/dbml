import Database, { RawDatabase } from '../model_structure/database';
declare class Parser {
    static parseJSONToDatabase(rawDatabase: RawDatabase): Database;
    static parseMySQLToJSON(str: String): RawDatabase;
    static parsePostgresToJSON(str: String): RawDatabase;
    static parseDBMLToJSON(str: String): RawDatabase;
    static parseSchemaRbToJSON(str: String): RawDatabase;
    static parseMSSQLToJSON(str: String): RawDatabase;
    static parse(str: String, format: 'mysql' | 'postgres' | 'dbml' | 'schemarb' | 'mssql' | 'json'): Database;
}
export default Parser;
