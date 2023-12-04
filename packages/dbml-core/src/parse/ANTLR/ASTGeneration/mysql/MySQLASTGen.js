import MySQLParserVisitor from '../../parsers/mysql/MySQLParserVisitor';
import { Enum, Field, Index, Table } from '../AST';

export default class MySQLASTGen extends MySQLParserVisitor {
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
    };
  }
}
