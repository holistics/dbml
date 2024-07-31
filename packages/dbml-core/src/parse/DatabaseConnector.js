import Database from '../model_structure/database';
import { fetchSchema } from './connection/ConnectionASTGeneration';

class DatabaseConnector {
  constructor (connection) {
    this.connection = connection;
  }

  static parseJSONToDatabase (rawDatabase) {
    const database = new Database(rawDatabase);
    return database;
  }

  static async fetchPostgresToJSON (connection) {
    return fetchSchema(connection, 'postgres');
  }

  async fetchSchema (format) {
    let rawDatabase = {};
    switch (format) {
      case 'postgres':
        rawDatabase = await DatabaseConnector.fetchPostgresToJSON(this.connection);
        break;

      default:
        break;
    }
    const schema = DatabaseConnector.parseJSONToDatabase(rawDatabase);
    return schema;
  }
}

export default DatabaseConnector;
