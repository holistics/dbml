import Database from '../model_structure/database';
import { fetch } from './connection/ConnectionASTGeneration';

class DatabaseConnector {
  constructor (connection) {
    this.connection = connection;
  }

  static parseJSONToDatabase (rawDatabase) {
    const database = new Database(rawDatabase);
    return database;
  }

  static async fetchPostgresToJSON (connection) {
    return fetch(connection, 'postgres');
  }

  async fetch (format) {
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
