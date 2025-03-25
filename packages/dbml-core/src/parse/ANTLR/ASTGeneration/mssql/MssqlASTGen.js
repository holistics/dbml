import TSqlParserVisitor from "../../parsers/mssql/TSqlParserVisitor";

export default class MssqlASTGen extends TSqlParserVisitor {
  constructor () {
    super();
    this.data = {
      schemas: [],
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      aliases: [],
      project: {},
      records: {},
    };
  }
}
