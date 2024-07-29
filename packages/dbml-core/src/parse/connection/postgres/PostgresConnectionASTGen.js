import { generateRawDb } from './utils';

export default class PostgresConnectionASTGen {
  constructor () {
    this.data = {
      schemas: [],
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      aliases: [],
      project: {},
    };
  }

  async fetch (connection) {
    const { tables, refs, enums } = await generateRawDb(connection);

    this.data.tables = tables;
    this.data.refs = refs;
    this.data.enums = enums;

    return this.data;
  }
}
