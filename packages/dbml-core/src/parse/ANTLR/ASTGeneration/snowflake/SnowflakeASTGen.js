/* eslint-disable class-methods-use-this */
import { isEmpty, flatten, get, values, add } from 'lodash';
import SnowflakeParserVisitor from '../../parsers/snowflake/SnowflakeParserVisitor';
import { Endpoint, Enum, Field, Index, Table, Ref } from '../AST';
import { TABLE_CONSTRAINT_KIND, COLUMN_CONSTRAINT_KIND, DATA_TYPE, CONSTRAINT_TYPE } from '../constants';
import { getOriginalText } from '../helpers';

const sanitizeComment = (stringContext) => {
  return getOriginalText(stringContext).replace(/''/g, "'").slice(1, -1);
};

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
    } else if (ctx.create_table_like()) {
      const [schemaNameLike, nameLike, schemaNameOrigin, nameOrigin] = ctx.create_table_like().accept(this);
      const originTable = this.data.tables.reduce((acc, ele) => {
        if (ele.name === nameOrigin && ele.schemaName === schemaNameOrigin) return ele;
        return acc;
      }, null);

      if (originTable) {
        const likeTable = new Table({
          name: nameLike,
          schemaName: schemaNameLike,
          fields: originTable.fields,
        });
        this.data.tables.push(likeTable);
      }
    }
  }

  // : CREATE or_replace? TRANSIENT? DATABASE if_not_exists? id_ clone_at_before? (
  //     DATA_RETENTION_TIME_IN_DAYS EQ num
  // )? (MAX_DATA_EXTENSION_TIME_IN_DAYS EQ num)? default_ddl_collation? with_tags? comment_clause?
  // ;
  visitCreate_database (ctx) {
    const schema = getOriginalText(ctx.object_name());
    this.data.schemas.push(schema);
  }

  // CREATE or_replace? table_type? TABLE (
  //   if_not_exists? object_name
  //   | object_name if_not_exists?
  // ) ((comment_clause? create_table_clause) | (create_table_clause comment_clause?))
  visitCreate_table (ctx) {
    const [databaseName, schemaName, tableName] = ctx.object_name().accept(this);

    const { definitions, tableNote } = ctx.create_table_clause().accept(this);
    const note = ctx.comment_clause()?.accept(this) || tableNote;

    const [fieldsData, indexes, tableRefs, singlePkIndex] = definitions.reduce((acc, ele) => {
      if (ele.kind === TABLE_CONSTRAINT_KIND.FIELD) acc[0].push(ele.value);
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

    const inlineRefsOfFields = fieldsData.map(fieldData => {
      const { field, inlineRefs } = fieldData;

      if (field.type.type_name?.toLowerCase() === 'enum') {
        const values = field.type.args.map(arg => {
          const newValue = arg.replace(/'|"|`/g, '').trim();
          return {
            name: newValue,
          };
        });

        const _enum = new Enum({
          name: `${tableName}_${field.name}_enum`,
          schemaName,
          values,
        });

        field.type.type_name = _enum.name;
        field.type.schemaName = _enum.schemaName;

        this.data.enums.push(_enum);
      }

      inlineRefs.forEach((inlineRef) => {
        inlineRef.endpoints[0].tableName = tableName;
        inlineRef.endpoints[0].schemaName = schemaName;
        inlineRef.endpoints[0].fieldNames = [field.name];
      });

      return inlineRefs;
    });

    this.data.refs.push(...flatten(inlineRefsOfFields));

    this.data.refs.push(...tableRefs.map(tableRef => {
      tableRef.endpoints[0].tableName = tableName;
      tableRef.endpoints[0].schemaName = schemaName;
      return tableRef;
    }));

    const table = new Table({
      name: tableName,
      schemaName,
      fields: fieldsData.map(fd => fd.field),
      indexes,
      note,
    });

    if (singlePkIndex) {
      const field = table.fields.find(f => f.name === singlePkIndex.columns[0].value);
      if (field) field.pk = true;
    }

    return table;
  }

  // : ALTER TABLE if_exists? object_name RENAME TO object_name
  // | ALTER TABLE if_exists? object_name SWAP WITH object_name
  // | ALTER TABLE if_exists? object_name (
  //     clustering_action
  //     | table_column_action
  //     | constraint_action
  // )
  // | ALTER TABLE if_exists? object_name ext_table_column_action
  // | ALTER TABLE if_exists? object_name search_optimization_action
  // | ALTER TABLE if_exists? object_name SET stage_file_format? (
  //     STAGE_COPY_OPTIONS EQ '(' copy_options ')'
  // )? (DATA_RETENTION_TIME_IN_DAYS EQ num)? (MAX_DATA_EXTENSION_TIME_IN_DAYS EQ num)? (
  //     CHANGE_TRACKING EQ true_false
  // )? default_ddl_collation? comment_clause?
  // | ALTER TABLE if_exists? object_name set_tags
  // | ALTER TABLE if_exists? object_name unset_tags
  // | ALTER TABLE if_exists? object_name UNSET (
  //     DATA_RETENTION_TIME_IN_DAYS
  //     | MAX_DATA_EXTENSION_TIME_IN_DAYS
  //     | CHANGE_TRACKING
  //     | DEFAULT_DDL_COLLATION_
  //     | COMMENT
  //     |
  // )
  // //[ , ... ]
  // | ALTER TABLE if_exists? object_name ADD ROW ACCESS POLICY id_ ON column_list_in_parentheses
  // | ALTER TABLE if_exists? object_name DROP ROW ACCESS POLICY id_
  // | ALTER TABLE if_exists? object_name DROP ROW ACCESS POLICY id_ COMMA ADD ROW ACCESS POLICY id_ ON column_list_in_parentheses
  // | ALTER TABLE if_exists? object_name DROP ALL ROW ACCESS POLICIES
  visitAlter_table (ctx) {
    if (ctx.constraint_action()) {
      const [databaseName, schemaName, tableName] = ctx.object_name()[0].accept(this);
      const definition = ctx.constraint_action().accept(this);

      if (definition) {
        const fieldsData = [];
        const indexes = [];
        const tableRefs = [];
        if (definition.kind === TABLE_CONSTRAINT_KIND.FIELD) fieldsData.push(definition.value);
        else if (definition.kind === TABLE_CONSTRAINT_KIND.UNIQUE) indexes.push(definition.value);
        else if (definition.kind === TABLE_CONSTRAINT_KIND.FK) tableRefs.push(definition.value);

        this.data.refs.push(...tableRefs.map(tableRef => {
          tableRef.endpoints[0].tableName = tableName;
          tableRef.endpoints[0].schemaName = schemaName;
          return tableRef;
        }));

        const table = this.data.tables.reduce((acc, ele) => {
          if (ele.name === tableName && ele.schemaName === schemaName) return ele;
          return acc;
        }, null);

        if (table) {
          table.fields.push(...fieldsData);
          table.indexes.push(...indexes);
        }
        return table;
      }
    }

    return null;
  }

  // CREATE or_replace? TRANSIENT? TABLE if_not_exists? object_name LIKE object_name cluster_by? copy_grants?
  visitCreate_table_like (ctx) {
    const [databaseNameLike, schemaNameLike, nameLike] = ctx.object_name()[0].accept(this);
    const [databaseNameOrigin, schemaNameOrigin, nameOrigin] = ctx.object_name()[1].accept(this);
    return [schemaNameLike, nameLike, schemaNameOrigin, nameOrigin];
  }

  // : d = id_ DOT s = id_ DOT o = id_
  // | s = id_ DOT o = id_
  // | o = id_
  visitObject_name (ctx) {
    return [
      ctx.d?.accept(this),
      ctx.s?.accept(this),
      ctx.o.accept(this),
    ];
  }

  // : ID | ID2 | DOUBLE_QUOTE_ID | DOUBLE_QUOTE_BLANK
  // | keyword | non_reserved_words | object_type_plural | data_type
  // | builtin_function | unary_or_binary_builtin_function | binary_builtin_function
  // | binary_or_ternary_builtin_function | ternary_builtin_function
  visitId_ (ctx) {
    if (ctx.DOUBLE_QUOTE_ID()) return getOriginalText(ctx).slice(1, -1);
    return getOriginalText(ctx);
  }

  // : (
  //     column_decl_item_list_paren cluster_by?
  //     | cluster_by? comment_clause? column_decl_item_list_paren
  // ) stage_file_format? (STAGE_COPY_OPTIONS EQ LR_BRACKET copy_options RR_BRACKET)? (
  //     DATA_RETENTION_TIME_IN_DAYS EQ num
  // )? (MAX_DATA_EXTENSION_TIME_IN_DAYS EQ num)? change_tracking? default_ddl_collation? copy_grants? comment_clause? with_row_access_policy?
  //     with_tags?
  visitCreate_table_clause (ctx) {
    return {
      definitions: ctx.column_decl_item_list_paren().accept(this),
      tableNote: ctx.comment_clause().map(c => c.accept(this))?.[-1],
    };
  }

  // : COMMENT EQ string
  visitComment_clause (ctx) {
    return sanitizeComment(ctx.string());
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
      const test = ctx.out_of_line_constraint().accept(this);
      return test;
    }

    return null;
  }

  // col_decl (collate | inline_constraint | null_not_null | (default_value | NULL_))* with_masking_policy? with_tags? ( COMMENT string )?
  visitFull_col_decl (ctx) {
    const field = ctx.col_decl().accept(this);
    const inlineRefs = [];

    if (ctx.inline_constraint()) {
      const inlineConstraints = ctx.inline_constraint().map(c => c.accept(this));
      if (!isEmpty(inlineConstraints)) {
        inlineConstraints.forEach(inlineConstraint => {
          if (inlineConstraint.kind === COLUMN_CONSTRAINT_KIND.UNIQUE) field.unique = true;
          else if (inlineConstraint.kind === COLUMN_CONSTRAINT_KIND.PK) field.pk = true;
          else if (inlineConstraint.kind === COLUMN_CONSTRAINT_KIND.FK) inlineRefs.push(inlineConstraint.value);
        });
      }
    }

    if (ctx.null_not_null()) {
      const notNulls = ctx.null_not_null().map(c => c.accept(this));
      if (!isEmpty(notNulls)) {
        notNulls.forEach(notNull => {
          if (notNull.kind === COLUMN_CONSTRAINT_KIND.NOT_NULL) field.not_null = notNull.value;
        });
      }
    }

    if (ctx.default_value()) {
      const defaultOrIncrements = ctx.default_value().map(c => c.accept(this));

      defaultOrIncrements.forEach(defaultOrIncrement => {
        if (defaultOrIncrement.kind === COLUMN_CONSTRAINT_KIND.DEFAULT) {
          field.dbdefault = defaultOrIncrement.value;
        } else if (defaultOrIncrement.kind === COLUMN_CONSTRAINT_KIND.INCREMENT) {
          field.increment = defaultOrIncrement.value;
        }
      });
    }

    if (ctx.COMMENT()) {
      field.note = sanitizeComment(ctx.string());
    }

    return {
      field,
      inlineRefs,
    };
  }

  // column_name data_type virtual_column_decl?
  visitCol_decl (ctx) {
    return new Field({
      name: ctx.column_name().accept(this),
      type: {
        type_name: getOriginalText(ctx.data_type()),
        schemaName: null,
      },
    });
  }

  // : (id_ '.')? id_
  visitColumn_name (ctx) {
    return ctx.id_().map(c => c.accept(this)).join('.');
  }

  // : (CONSTRAINT id_)? (
  //     (UNIQUE | primary_key) common_constraint_properties*
  //     | foreign_key REFERENCES object_name (LR_BRACKET column_name RR_BRACKET)? constraint_properties
  // )
  visitInline_constraint (ctx) {
    if (ctx.UNIQUE()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.UNIQUE,
        value: true,
      };
    }
    if (ctx.primary_key()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.PK,
        value: true,
      };
    }
    if (ctx.foreign_key() && ctx.column_name()) {
      const [databaseName, schemaName, tableName] = ctx.object_name().accept(this);
      const destColumns = [ctx.column_name().accept(this)];
      return {
        kind: COLUMN_CONSTRAINT_KIND.FK,
        value: {
          endpoints: [
            {
              tableName: null,
              schemaName: null,
              fieldNames: null,
              relation: '*',
            },
            {
              tableName,
              schemaName,
              fieldNames: destColumns,
              relation: '1',
            },
          ],
        },
      };
    }
    return {
      kind: null,
      value: null,
    };
  }

  // : (CONSTRAINT id_)? (
  //     (UNIQUE | primary_key) column_list_in_parentheses common_constraint_properties*
  //     | foreign_key column_list_in_parentheses REFERENCES object_name column_list_in_parentheses constraint_properties
  // )
  visitOut_of_line_constraint (ctx) {
    if (ctx.UNIQUE()) {
      const name = ctx.id_()?.accept(this);
      const colNames = flatten(ctx.column_list_in_parentheses().map(c => c.accept(this)));
      const value = new Index({
        unique: true,
        columns: colNames.map(colName => ({ value: colName, type: CONSTRAINT_TYPE.COLUMN })),
      });
      return {
        name,
        kind: TABLE_CONSTRAINT_KIND.UNIQUE,
        value,
      };
    }
    if (ctx.primary_key()) {
      const name = ctx.id_()?.accept(this);
      const colNames = flatten(ctx.column_list_in_parentheses().map(c => c.accept(this)));
      const value = new Index({
        name,
        pk: true,
        columns: colNames.map(colName => ({ value: colName, type: CONSTRAINT_TYPE.COLUMN })),
      });
      return {
        kind: TABLE_CONSTRAINT_KIND.PK,
        value,
      };
    }
    if (ctx.foreign_key() && ctx.column_list_in_parentheses().length === 2) {
      const [databaseName, schemaName, tableName] = ctx.object_name().accept(this);
      const sourceColumns = ctx.column_list_in_parentheses()[0].accept(this);
      const destColumns = ctx.column_list_in_parentheses()[1].accept(this);
      return {
        kind: TABLE_CONSTRAINT_KIND.FK,
        value: {
          endpoints: [
            {
              tableName: null,
              schemaName: null,
              fieldNames: sourceColumns,
              relation: '*',
            },
            {
              tableName,
              schemaName,
              fieldNames: destColumns,
              relation: '1',
            },
          ],
        },
      };
    }

    return null;
  }

  // LR_BRACKET column_list RR_BRACKET
  visitColumn_list_in_parentheses (ctx) {
    return ctx.column_list().accept(this);
  }

  // column_name (COMMA column_name)*
  visitColumn_list (ctx) {
    return ctx.column_name().map(c => c.accept(this));
  }

  // NOT? NULL_
  visitNull_not_null (ctx) {
    return {
      kind: COLUMN_CONSTRAINT_KIND.NOT_NULL,
      value: !!ctx.NOT(),
    };
  }

  // : DEFAULT expr
  // | (AUTOINCREMENT | IDENTITY) (
  //     LR_BRACKET num COMMA num RR_BRACKET
  //     | start_with
  //     | increment_by
  //     | start_with increment_by
  // )? order_noorder?
  visitDefault_value (ctx) {
    // dbdefault: {value: string, type: 'string' | 'number' | 'boolean' | 'expression'},
    if (ctx.DEFAULT()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.DEFAULT,
        value: ctx.expr().accept(this),
      };
    }
    if (ctx.AUTOINCREMENT() || ctx.IDENTITY()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.INCREMENT,
        value: true,
      };
    }
    return null;
  }

  //  : object_name DOT NEXTVAL
  //  | expr LSB expr RSB //array access
  //  | expr COLON expr   //json access
  //  | expr DOT (VALUE | expr)
  //  | expr COLLATE string
  //  | case_expression
  //  | iff_expr
  //  | bracket_expression
  //  | op = ( PLUS | MINUS) expr
  //  | expr op = (STAR | DIVIDE | MODULE) expr
  //  | expr op = (PLUS | MINUS | PIPE_PIPE) expr
  //  | expr comparison_operator expr
  //  | op = NOT+ expr
  //  | expr AND expr //bool operation
  //  | expr OR expr  //bool operation
  //  | arr_literal
  //  //    | expr time_zone
  //  | expr over_clause
  //  | cast_expr
  //  | expr COLON_COLON data_type // Cast also
  //  | try_cast_expr
  //  | json_literal
  //  | trim_expression
  //  | function_call
  //  | subquery
  //  | expr IS null_not_null
  //  | expr NOT? IN LR_BRACKET (subquery | expr_list) RR_BRACKET
  //  | expr NOT? ( LIKE | ILIKE) expr (ESCAPE expr)?
  //  | expr NOT? RLIKE expr
  //  | expr NOT? (LIKE | ILIKE) ANY LR_BRACKET expr (COMMA expr)* RR_BRACKET (ESCAPE expr)?
  //  | primitive_expression //Should be latest rule as it's nearly a catch all
  visitExpr (ctx) {
    if (ctx.primitive_expression()) return ctx.primitive_expression().accept(this);
    return { value: getOriginalText(ctx), type: 'expression' };
  }

  // : DEFAULT //?
  // | NULL_
  // | id_ ('.' id_)* // json field access
  // | full_column_name
  // | literal
  // | BOTH_Q
  // | ARRAY_Q
  // | OBJECT_Q
  // //| json_literal
  // //| arr_literal
  visitPrimitive_expression (ctx) {
    if (ctx.NULL_()) return { value: null, type: 'boolean' };
    if (ctx.literal()) return ctx.literal().accept(this);
    return { value: getOriginalText(ctx), type: 'expression' };
  }

  //  : STRING // string, date, time, timestamp
  //  | sign? DECIMAL
  //  | sign? (REAL | FLOAT)
  //  | true_false
  //  | NULL_
  //  | AT_Q
  //  ;
  visitLiteral (ctx) {
    if (ctx.STRING()) return { value: sanitizeComment(ctx), type: 'string' };
    if (ctx.DECIMAL() || ctx.REAL || ctx.FLOAT) return { value: getOriginalText(ctx), type: 'number' };
    if (ctx.true_false() || ctx.NULL_()) return { value: getOriginalText(ctx), type: 'boolean' };
    return { value: getOriginalText(ctx), type: 'expression' };
  }

  // : ADD out_of_line_constraint
  // | RENAME CONSTRAINT id_ TO id_
  // | alter_modify (CONSTRAINT id_ | primary_key | UNIQUE | foreign_key) column_list_in_parentheses enforced_not_enforced? (
  //     VALIDATE
  //     | NOVALIDATE
  // ) (RELY | NORELY)
  // | DROP (CONSTRAINT id_ | primary_key | UNIQUE | foreign_key) column_list_in_parentheses? cascade_restrict?
  // | DROP PRIMARY KEY
  visitConstraint_action (ctx) {
    if (ctx.ADD()) {
      return ctx.out_of_line_constraint().accept(this);
    }
    return null;
  }
}
