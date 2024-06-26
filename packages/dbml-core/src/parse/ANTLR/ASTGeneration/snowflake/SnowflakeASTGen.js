import SnowflakeParserVisitor from '../../parsers/snowflake/SnowflakeParserVisitor';
import { Endpoint, Enum, Field, Index, Table, Ref } from '../AST';
import { TABLE_CONSTRAINT_KIND, COLUMN_CONSTRAINT_KIND, DATA_TYPE, CONSTRAINT_TYPE } from '../constants';

export default class SnowflakeASTGen extends SnowflakeParserVisitor {
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
