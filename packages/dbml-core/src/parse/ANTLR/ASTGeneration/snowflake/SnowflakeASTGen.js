/* eslint-disable class-methods-use-this */
import SnowflakeParserVisitor from '../../parsers/snowflake/SnowflakeParserVisitor';
import { Endpoint, Enum, Field, Index, Table, Ref } from '../AST';
import { TABLE_CONSTRAINT_KIND, COLUMN_CONSTRAINT_KIND, DATA_TYPE, CONSTRAINT_TYPE } from '../constants';
import { getOriginalText } from '../helpers';

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

  // batch? EOF
  visitSnowflake_file (ctx) {
    ctx.batch()?.accept(this);
    return this.data;
  }

  // sql_command (SEMI sql_command)* SEMI?
  visitBatch (ctx) {
    ctx.sql_command().forEach(c => {
      c.accept(this);
    });
  }

  // ddl_command | dml_command | show_command | use_command | describe_command | other_command
  visitSql_command (ctx) {
    if (ctx.ddl_command()) {
      ctx.ddl_command().accept(this);
    }
  }

  // alter_command | create_command | drop_command | undrop_command
  visitDdl_command (ctx) {
    if (ctx.alter_command()) {
      ctx.alter_command().accept(this);
    } else if (ctx.create_command()) {
      ctx.create_command().accept(this);
    }
  }

  // check SnowflakeParser.g4 line 1442
  visitCreate_command (ctx) {
    if (ctx.create_table()) {
      const table = ctx.create_table().accept(this);
      this.data.tables.push(table);
    }
  }

  /*
  CREATE or_replace? table_type? TABLE (
    if_not_exists? object_name
    | object_name if_not_exists?
  ) ((comment_clause? create_table_clause) | (create_table_clause comment_clause?))
  */
  visitCreate_table (ctx) {
    const [databaseName, schemaName, name] = ctx.object_name().accept(this);

    const definitions = ctx.create_table_clause().accept(this);

    const [fieldsData, indexes, tableRefs, singlePkIndex] = definitions.reduce((acc, ele) => {
      if (ele.kind === TABLE_CONSTRAINT_KIND.FIELD) acc[0].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.INDEX) acc[1].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.UNIQUE) acc[1].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.FK) acc[2].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.PK) {
        /** @type {Index} */
        const index = ele.value;
        if (index.columns.length > 1) acc[1].push(ele.value);
        else acc[3] = index;
      }
      return acc;
    }, [[], [], [], null]);

    return new Table({
      name,
      schemaName,
      fields: fieldsData.map(fd => fd.field),
    });
  }

  /*
  d = id_ DOT s = id_ DOT o = id_
  | s = id_ DOT o = id_
  | o = id_
  */
  visitObject_name (ctx) {
    return [
      ctx.d?.accept(this),
      ctx.s?.accept(this),
      ctx.o.accept(this),
    ];
  }

  /*
  ID | ID2 | DOUBLE_QUOTE_ID | DOUBLE_QUOTE_BLANK
  | keyword | non_reserved_words | object_type_plural | data_type
  | builtin_function | unary_or_binary_builtin_function | binary_builtin_function
  | binary_or_ternary_builtin_function | ternary_builtin_function
  */
  visitId_ (ctx) {
    // console.log(ctx);
    return getOriginalText(ctx);
  }

  /*
  (
    column_decl_item_list_paren cluster_by?
    | cluster_by? comment_clause? column_decl_item_list_paren
  ) stage_file_format? (STAGE_COPY_OPTIONS EQ LR_BRACKET copy_options RR_BRACKET)? (
    DATA_RETENTION_TIME_IN_DAYS EQ num
  )? (MAX_DATA_EXTENSION_TIME_IN_DAYS EQ num)? change_tracking? default_ddl_collation? copy_grants? comment_clause? with_row_access_policy?
    with_tags?
  */
  visitCreate_table_clause (ctx) {
    return ctx.column_decl_item_list_paren().accept(this);
  }

  // '(' column_decl_item_list ')'
  visitColumn_decl_item_list_paren (ctx) {
    return ctx.column_decl_item_list().accept(this);
  }

  // column_decl_item (COMMA column_decl_item)*
  visitColumn_decl_item_list (ctx) {
    return ctx.column_decl_item().map(c => c.accept(this)).filter(r => r);
  }

  // full_col_decl | out_of_line_constraint
  visitColumn_decl_item (ctx) {
    if (ctx.full_col_decl()) {
      return {
        kind: TABLE_CONSTRAINT_KIND.FIELD,
        value: ctx.full_col_decl().accept(this),
      };
    }

    if (ctx.out_of_line_constraint()) {
      return null;
    }

    return null;
  }

  // col_decl (collate | inline_constraint | null_not_null | (default_value | NULL_))* with_masking_policy? with_tags? ( COMMENT string )?
  visitFull_col_decl (ctx) {
    const field = ctx.col_decl().accept(this);

    // TODO: add field attribute

    const inlineRefs = []; // TODO accept inline_constraint

    return {
      field,
      inlineRefs,
    };
  }

  // column_name data_type virtual_column_decl?
  visitCol_decl (ctx) {
    return new Field({
      name: getOriginalText(ctx.column_name()),
      type: {
        type_name: getOriginalText(ctx.data_type()),
        schemaName: null,
      },
    });
  }
}
