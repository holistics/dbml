import Database, { RawDatabase } from '../model_structure/database';
declare class DatabaseConnector {
    constructor(DBMLCompiler?: Compiler);
    static parseJSONToDatabase(rawDatabase: RawDatabase): Database;
    static fetchPostgresToJSON(): Promise<RawDatabase>;
    fetch(format: 'postgres'): Promise<Database>;
}
export default DatabaseConnector;
