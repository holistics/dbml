import { generateRawDb } from './utils';

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
    const { tables, refs } = await generateRawDb(connection);

    this.data.tables = tables;
    this.data.refs = refs;

    return this.data;
  }
}
