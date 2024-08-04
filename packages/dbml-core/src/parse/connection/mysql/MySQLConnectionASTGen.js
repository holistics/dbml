import { generateRawDb } from './utils/sql';

export default class MySQLConnectionASTGen {
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

  async fetchSchema (connection) {
    const { tables, refs, enums } = await generateRawDb(connection);

    this.data.tables = tables;
    this.data.refs = refs;
    this.data.enums = enums;

    return this.data;
  }
}
