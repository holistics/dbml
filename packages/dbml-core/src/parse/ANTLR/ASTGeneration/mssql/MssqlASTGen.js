/* eslint-disable class-methods-use-this */
import {
  first, flatten, flattenDepth, last, nth,
} from 'lodash';
import { getFullTableName } from '../../../../model_structure/utils';
import TSqlParserVisitor from '../../parsers/mssql/TSqlParserVisitor';
import { COLUMN_CONSTRAINT_KIND, DATA_TYPE, TABLE_CONSTRAINT_KIND } from '../constants';
import { getOriginalText } from '../helpers';
import { Field, Index, Table } from '../AST';

const getSchemaAndTableName = (names) => {
  const tableName = last(names);
  const schemaName = names.length > 1 ? nth(names, -2) : undefined;
  return {
    schemaName,
    tableName,
  };
};

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

  // tsql_file
  //   : batch* EOF
  //   | execute_body_batch go_statement* EOF
  //   ;
  visitTsql_file (ctx) {
    ctx.batch().forEach((batch) => batch.accept(this));
    return this.data;
  }

  // batch
  //   : go_statement
  //   | execute_body_batch? (go_statement | sql_clauses+) go_statement*
  //   | batch_level_statement go_statement*
  //   ;
  visitBatch (ctx) {
    if (ctx.sql_clauses()) {
      ctx.sql_clauses().forEach((sqlClause) => sqlClause.accept(this));
    }
  }

  // sql_clauses
  //   : dml_clause SEMI?
  //   | cfl_statement SEMI?
  //   | another_statement SEMI?
  //   | ddl_clause SEMI?
  //   | dbcc_clause SEMI?
  //   | backup_statement SEMI?
  //   | SEMI
  //   ;
  visitSql_clauses (ctx) {
    if (ctx.ddl_clause()) {
      ctx.ddl_clause().accept(this);
      return;
    }

    if (ctx.dml_clause()) {
      ctx.dml_clause().accept(this);
    }
  }

  // dml_clause
  //   : merge_statement
  //   | delete_statement
  //   | insert_statement
  //   | select_statement_standalone
  //   | update_statement
  //   ;
  visitDml_clause (ctx) {
    if (ctx.insert_statement()) {
      ctx.insert_statement().accept(this);
    }
  }

  // insert_statement
  //   : with_expression? INSERT (TOP '(' expression ')' PERCENT?)? INTO? (
  //       ddl_object
  //       | rowset_function_limited
  //   ) with_table_hints? ('(' insert_column_name_list ')')? output_clause? insert_statement_value for_clause? option_clause? ';'?
  //   ;
  visitInsert_statement (ctx) {
    // [ 'users' ]
    // [ 'test', 'users' ]
    // [ 'db', 'test', 'users' ]
    // [ 'server', 'db', 'test', 'users' ]
    // The last: table name
    // The second-last: schema name
    const names = ctx.ddl_object().accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? nth(names, -2) : undefined;

    const columns = ctx.insert_column_name_list() ? ctx.insert_column_name_list().accept(this) : [];
    const values = ctx.insert_statement_value().accept(this);

    // handle insert into all columns
    if (columns.length === 0 || values.length === 0) {
      // temporarily ignore
      return;
    }

    const fullTableName = getFullTableName(schemaName, tableName);

    if (!this.data.records[fullTableName]) {
      this.data.records[fullTableName] = {
        schemaName,
        tableName,
        columns,
        values: [],
      };
    }

    this.data.records[fullTableName].values.push(...values);
  }

  // ddl_object
  //   : full_table_name
  //   | LOCAL_ID
  //   ;
  visitDdl_object (ctx) {
    return ctx.full_table_name().accept(this);
  }

  // full_table_name
  //   : (
  //       linkedServer = id_ '.' '.' schema = id_ '.'
  //       | server = id_ '.' database = id_ '.' schema = id_ '.'
  //       | database = id_ '.' schema = id_? '.'
  //       | schema = id_ '.'
  //   )? table = id_
  //   ;
  visitFull_table_name (ctx) {
    return ctx.id_().map((id) => id.accept(this));
  }

  // id_
  //   : ID
  //   | TEMP_ID
  //   | DOUBLE_QUOTE_ID
  //   | DOUBLE_QUOTE_BLANK
  //   | SQUARE_BRACKET_ID
  //   | keyword
  //   | RAW
  //   ;
  visitId_ (ctx) {
    if (ctx.DOUBLE_QUOTE_ID() || ctx.SQUARE_BRACKET_ID()) return getOriginalText(ctx).slice(1, -1);
    return getOriginalText(ctx);
  }

  // insert_column_name_list
  //   : col += insert_column_id (',' col += insert_column_id)*
  //   ;
  visitInsert_column_name_list (ctx) {
    const columns = ctx.insert_column_id().map((column) => column.accept(this));
    return flattenDepth(columns, 1);
  }

  // insert_column_id
  //   : (ignore += id_? '.')* id_
  //   ;

  // insert_statement_value
  //   : table_value_constructor
  //   | derived_table
  //   | execute_statement
  //   | DEFAULT VALUES
  //   ;
  visitInsert_statement_value (ctx) {
    if (!ctx.table_value_constructor()) return [];

    const rawValues = ctx.table_value_constructor().accept(this);
    return rawValues;
  }

  // table_value_constructor
  //   : VALUES '(' exps += expression_list_ ')' (',' '(' exps += expression_list_ ')')*
  //   ;
  visitTable_value_constructor (ctx) {
    return ctx.expression_list_().map((expression) => expression.accept(this));
  }

  // expression_list_
  //   : exp += expression (',' exp += expression)*
  //   ;
  visitExpression_list_ (ctx) {
    return ctx.expression().map((expression) => expression.accept(this));
  }

  // expression
  //   : primitive_expression
  //   | function_call
  //   | expression '.' (value_call | query_call | exist_call | modify_call)
  //   | expression '.' hierarchyid_call
  //   | expression COLLATE id_
  //   | case_expression
  //   | full_column_name
  //   | bracket_expression
  //   | unary_operator_expression
  //   | expression op = ('*' | '/' | '%') expression
  //   | expression op = ('+' | '-' | '&' | '^' | '|' | '||') expression
  //   | expression time_zone
  //   | over_clause
  //   | DOLLAR_ACTION
  //   ;

  visitExpression (ctx) {
    if (ctx.primitive_expression()) {
      return ctx.primitive_expression().accept(this);
    }

    if (ctx.function_call()) {
      return ctx.function_call().accept(this);
    }

    if (ctx.unary_operator_expression()) {
      return ctx.unary_operator_expression().accept(this);
    }

    // Default case for any other expression type
    return {
      value: getOriginalText(ctx),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  // primitive_constant
  //   : STRING // string, datetime or uniqueidentifier
  //   | BINARY
  //   | (DECIMAL | REAL | FLOAT)                    // float or decimal
  //   | dollar = '$' ('-' | '+')? (DECIMAL | FLOAT) // money
  //   | parameter
  //   ;
  visitPrimitive_constant (ctx) {
    if (ctx.STRING() || ctx.BINARY()) {
      const value = ctx.getText();
      if (value.startsWith("N'")) {
        return {
          value,
          type: DATA_TYPE.EXPRESSION,
        };
      }

      return {
        value: value.slice(1, value.length - 1),
        type: DATA_TYPE.STRING,
      };
    }

    if (ctx.DOLLAR()) {
      const dollar = first(ctx.children).getText();
      const sign = ctx.children.length > 2 ? nth(ctx.children, -2) : '';
      const value = last(ctx.children).getText();
      return {
        value: `${dollar}${sign}${value}`,
        type: DATA_TYPE.STRING,
      };
    }

    if (ctx.REAL() || ctx.DECIMAL() || ctx.FLOAT()) {
      return {
        value: ctx.getText(),
        type: DATA_TYPE.NUMBER,
      };
    }

    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  // function_call
  //   : ranking_windowed_function                      # RANKING_WINDOWED_FUNC
  //   | aggregate_windowed_function                    # AGGREGATE_WINDOWED_FUNC
  //   | analytic_windowed_function                     # ANALYTIC_WINDOWED_FUNC
  //   | built_in_functions                             # BUILT_IN_FUNC
  //   | scalar_function_name '(' expression_list_? ')' # SCALAR_FUNCTION
  //   | freetext_function                              # FREE_TEXT
  //   | partition_function                             # PARTITION_FUNC
  //   | hierarchyid_static_method                      # HIERARCHYID_METHOD
  //   ;

  // See packages/dbml-core/src/parse/ANTLR/parsers/mssql/TSqlParser.g4 at line 4338
  visitBUILT_IN_FUNC (ctx) {
    return {
      value: getOriginalText(ctx),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  // unary_operator_expression
  //   : '~' expression
  //   | op = ('+' | '-') expression
  //   ;
  visitUnary_operator_expression (ctx) {
    const operator = ctx.children[0].getText();
    const expression = ctx.expression().accept(this);

    return {
      value: `${operator}${expression.value}`,
      type: expression.type,
    };
  }

  // data_type
  //   : scaled = (VARCHAR | NVARCHAR | BINARY_KEYWORD | VARBINARY_KEYWORD | SQUARE_BRACKET_ID) '(' MAX ')'
  //   | ext_type = id_ '(' scale = DECIMAL ',' prec = DECIMAL ')'
  //   | ext_type = id_ '(' scale = DECIMAL ')'
  //   | ext_type = id_ IDENTITY ('(' seed = DECIMAL ',' inc = DECIMAL ')')?
  //   | double_prec = DOUBLE PRECISION?
  //   | unscaled_type = id_
  //   ;
  visitData_type (ctx) {
    return getOriginalText(ctx);
  }

  visitPrimitive_expression (ctx) {
    if (ctx.NULL_()) {
      return {
        value: ctx.getText(),
        type: DATA_TYPE.EXPRESSION,
      };
    }

    if (ctx.primitive_constant()) {
      return ctx.primitive_constant().accept(this);
    }

    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  // ddl_clause
  //   | alter_table
  //   | create_index
  //   | create_table
  //   ;
  // more details at: packages/dbml-core/src/parse/ANTLR/parsers/mssql/TSqlParser.g4 line 73
  visitDdl_clause (ctx) {
    if (ctx.create_table()) {
      ctx.create_table().accept(this);
      return;
    }

    if (ctx.alter_table()) {
      ctx.alter_table().accept(this);
      return;
    }

    if (ctx.create_index()) {
      ctx.create_index().accept(this);
    }
  }

  // create_table
  //   : CREATE TABLE table_name '(' column_def_table_constraints (','? table_indices)* ','? ')' (
  //       LOCK simple_id
  //   )? table_options* (ON id_ | DEFAULT | on_partition_or_filegroup)? (TEXTIMAGE_ON id_ | DEFAULT)? ';'?
  //   ;
  visitCreate_table (ctx) {
    const { schemaName, tableName } = getSchemaAndTableName(ctx.table_name().accept(this));

    const columnDefTableConstraints = ctx.column_def_table_constraints().accept(this);
    const tableIndices = ctx.table_indices().map((tableIndex) => tableIndex.accept(this));

    const [fieldsData, indexes, tableRefs] = columnDefTableConstraints.reduce((acc, columnDefTableConstraint) => {
      if (columnDefTableConstraint.kind === TABLE_CONSTRAINT_KIND.INDEX) {
        acc[1].push(columnDefTableConstraint.value);
      } else if (columnDefTableConstraint.kind === TABLE_CONSTRAINT_KIND.FIELD) {
        acc[0].push(columnDefTableConstraint.value);
      } else if (columnDefTableConstraint.kind === TABLE_CONSTRAINT_KIND.FK) {
        acc[2].push(columnDefTableConstraint.value);
      } else if (columnDefTableConstraint.kind === TABLE_CONSTRAINT_KIND.PK) {
        acc[1].push(columnDefTableConstraint.value);
      } else if (columnDefTableConstraint.kind === TABLE_CONSTRAINT_KIND.UNIQUE) {
        acc[1].push(columnDefTableConstraint.value);
      }

      return acc;
    }, [[], [], []]);

    const inlineRefs = fieldsData.map((fieldData) => fieldData.inline_refs.map(inlineRef => {
      inlineRef.endpoints[0].tableName = tableName;
      inlineRef.endpoints[0].schemaName = schemaName;
      inlineRef.endpoints[0].fieldNames = [fieldData.field.name];
      return inlineRef;
    }));

    this.data.refs.push(...flatten(inlineRefs));

    this.data.refs.push(...tableRefs.map(tableRef => {
      tableRef.endpoints[0].tableName = tableName;
      tableRef.endpoints[0].schemaName = schemaName;
      return tableRef;
    }));

    const table = new Table({
      name: tableName,
      schemaName,
      fields: fieldsData.map((fieldData) => fieldData.field),
      indexes: tableIndices.concat(indexes),
      note: { value: '' },
    });

    this.data.tables.push(table);
  }

  // table_name
  //   : (database = id_ '.' schema = id_? '.' | schema = id_ '.')? (
  //       table = id_
  //       | blocking_hierarchy = BLOCKING_HIERARCHY
  //   )
  //   ;
  visitTable_name (ctx) {
    return ctx.id_().map((id) => id.accept(this));
  }

  // column_def_table_constraints
  //   : column_def_table_constraint (','? column_def_table_constraint)*
  //   ;
  visitColumn_def_table_constraints (ctx) {
    return ctx
      .column_def_table_constraint()
      .map((columnDef) => columnDef.accept(this))
      .filter((columnDef) => columnDef);
  }

  // column_def_table_constraint
  //   : column_definition
  //   | materialized_column_definition
  //   | table_constraint
  //   ;
  visitColumn_def_table_constraint (ctx) {
    if (ctx.column_definition()) {
      return ctx.column_definition().accept(this);
    }

    if (ctx.table_constraint()) {
      return ctx.table_constraint().accept(this);
    }

    return null;
  }

  // column_definition
  // : id_ (data_type | AS expression PERSISTED?) column_definition_element* column_index?
  // ;
  visitColumn_definition (ctx) {
    const columnName = ctx.id_().accept(this);

    let type = '';
    if (ctx.data_type()) {
      type = ctx.data_type().accept(this);
    } else if (ctx.expression()) {
      // { value: "(first_name + ' ' + last_name)", type: 'expression' }
      const expression = ctx.expression().accept(this);
      const as = ctx.AS().getText();
      const persisted = ctx.PERSISTED() ? ` ${ctx.PERSISTED().getText()}` : '';
      type = `${as} ${expression.value}${persisted}`;
    }

    const field = new Field({
      name: columnName,
      type: {
        type_name: type,
        schemaName: undefined,
      },
    });

    const definition = {
      kind: TABLE_CONSTRAINT_KIND.FIELD,
      value: {
        field,
        inline_refs: [],
      },
    };

    const columnDefinitions = ctx.column_definition_element().map((columnDef) => columnDef.accept(this));

    // e.g.
    // [
    //   { kind: 'not_null', value: true },
    //   { kind: 'dbdefault', value: { value: 'GETDATE()', type: 'expression' } }
    // ]
    columnDefinitions
      .filter((columnDef) => columnDef)
      .forEach((columnDef) => {
        switch (columnDef.kind) {
          case COLUMN_CONSTRAINT_KIND.DEFAULT:
            field.dbdefault = columnDef.value;
            break;
          case COLUMN_CONSTRAINT_KIND.NOT_NULL:
            field.not_null = columnDef.value;
            break;
          case COLUMN_CONSTRAINT_KIND.PK:
            field.pk = columnDef.value;
            break;
          case COLUMN_CONSTRAINT_KIND.UNIQUE:
            field.unique = columnDef.value;
            break;
          case COLUMN_CONSTRAINT_KIND.INLINE_REF:
            definition.value.inline_refs.push(columnDef.value);
            break;
          default:
            break;
        }
      });

    // skip column index since it is just the name of the index that a column belongs to

    return definition;
  }

  // column_definition_element
  //   : FILESTREAM
  //   | COLLATE collation_name = id_
  //   | SPARSE
  //   | MASKED WITH '(' FUNCTION '=' mask_function = STRING ')'
  //   | (CONSTRAINT constraint = id_)? DEFAULT constant_expr = expression
  //   | IDENTITY ('(' seed = DECIMAL ',' increment = DECIMAL ')')?
  //   | NOT FOR REPLICATION
  //   | GENERATED ALWAYS AS (ROW | TRANSACTION_ID | SEQUENCE_NUMBER) (START | END) HIDDEN_KEYWORD?
  //   // NULL / NOT NULL is a constraint
  //   | ROWGUIDCOL
  //   | ENCRYPTED WITH '(' COLUMN_ENCRYPTION_KEY '=' key_name = STRING ',' ENCRYPTION_TYPE '=' (
  //       DETERMINISTIC
  //       | RANDOMIZED
  //   ) ',' ALGORITHM '=' algo = STRING ')'
  //   | column_constraint
  //   ;
  visitColumn_definition_element (ctx) {
    if (ctx.DEFAULT()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.DEFAULT,
        value: ctx.expression().accept(this),
      };
    }

    if (ctx.column_constraint()) {
      return ctx.column_constraint().accept(this);
    }

    return null;
  }

  // column_constraint
  //   : (CONSTRAINT constraint = id_)? (
  //       null_notnull
  //       | ( (PRIMARY KEY | UNIQUE) clustered? primary_key_options)
  //       | ( (FOREIGN KEY)? foreign_key_options)
  //       | check_constraint
  //   )
  //   ;
  visitColumn_constraint (ctx) {
    if (ctx.null_notnull()) {
      let notNull = false;
      const nullNotnull = ctx.null_notnull().accept(this);

      if (nullNotnull.includes('NOT')) notNull = true;

      return {
        kind: COLUMN_CONSTRAINT_KIND.NOT_NULL,
        value: notNull,
      };
    }

    if (ctx.UNIQUE()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.UNIQUE,
        value: true,
      };
    }

    if (ctx.PRIMARY()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.PK,
        value: true,
      };
    }

    if (ctx.foreign_key_options()) {
      const {
        refTableName, refSchemaName, fieldNames, onDelete, onUpdate,
      } = ctx.foreign_key_options().accept(this);

      return {
        kind: COLUMN_CONSTRAINT_KIND.INLINE_REF,
        value: {
          endpoints: [
            {
              tableName: null,
              schemaName: null,
              fieldNames: null,
              relation: '*',
            },
            {
              tableName: refTableName,
              schemaName: refSchemaName,
              fieldNames,
              relation: '1',
            },
          ],
          onDelete,
          onUpdate,
        },
      };
    }

    // we do not handle check constraint since it is complicated and hard to extract enum from it

    return null;
  }

  visitNull_notnull (ctx) {
    return getOriginalText(ctx);
  }

  // foreign_key_options
  //   : REFERENCES table_name '(' pk = column_name_list ')' (on_delete | on_update)* (
  //       NOT FOR REPLICATION
  //   )?
  //   ;
  visitForeign_key_options (ctx) {
    const names = ctx.table_name().accept(this);
    const { schemaName: refSchemaName, tableName: refTableName } = getSchemaAndTableName(names);

    const fieldNames = ctx.column_name_list().accept(this);

    const onDelete = ctx.on_delete() ? ctx.on_delete().map((action) => action.accept(this))[0] : null;
    const onUpdate = ctx.on_update() ? ctx.on_update().map((action) => action.accept(this))[0] : null;

    return {
      refTableName,
      refSchemaName,
      onDelete,
      onUpdate,
      fieldNames,
    };
  }

  // column_name_list
  //   : col += id_ (',' col += id_)*
  //   ;
  visitColumn_name_list (ctx) {
    return ctx.id_().map((id) => id.accept(this));
  }

  // on_delete
  //   : ON DELETE (NO ACTION | CASCADE | SET NULL_ | SET DEFAULT)
  //   ;
  visitOn_delete (ctx) {
    if (ctx.NO()) {
      return 'NO ACTION';
    }

    if (ctx.CASCADE()) {
      return 'CASCADE';
    }

    if (ctx.NULL_()) {
      return 'SET NULL';
    }

    return 'SET DEFAULT';
  }

  // on_update
  //   : ON UPDATE (NO ACTION | CASCADE | SET NULL_ | SET DEFAULT)
  //   ;
  visitOn_update (ctx) {
    if (ctx.NO()) {
      return 'NO ACTION';
    }

    if (ctx.CASCADE()) {
      return 'CASCADE';
    }

    if (ctx.NULL_()) {
      return 'SET NULL';
    }

    return 'SET DEFAULT';
  }

  // table_constraint
  //   : (CONSTRAINT constraint = id_)? (
  //       ((PRIMARY KEY | UNIQUE) clustered? '(' column_name_list_with_order ')' primary_key_options)
  //       | ( FOREIGN KEY '(' fk = column_name_list ')' foreign_key_options)
  //       | ( CONNECTION '(' connection_node ( ',' connection_node)* ')')
  //       | ( DEFAULT constant_expr = expression FOR column = id_ (WITH VALUES)?)
  //       | check_constraint
  //   )
  //   ;
  visitTable_constraint (ctx) {
    const name = ctx.id_() ? ctx.id_().map((id) => id.accept(this))[0] : '';

    if (ctx.PRIMARY() || ctx.UNIQUE()) {
      const columns = ctx.column_name_list_with_order().accept(this);

      return {
        kind: ctx.PRIMARY() ? TABLE_CONSTRAINT_KIND.PK : TABLE_CONSTRAINT_KIND.UNIQUE,
        value: new Index({
          name,
          columns,
          pk: !!ctx.PRIMARY(),
          unique: !!ctx.UNIQUE(),
        }),
      };
    }

    if (ctx.FOREIGN()) {
      const columns = ctx.column_name_list().accept(this);

      const {
        refTableName, refSchemaName, fieldNames, onDelete, onUpdate,
      } = ctx.foreign_key_options().accept(this);

      return {
        kind: TABLE_CONSTRAINT_KIND.FK,
        value: {
          name,
          endpoints: [
            {
              tableName: null,
              schemaName: null,
              fieldNames: columns,
              relation: '*',
            }, {
              tableName: refTableName,
              schemaName: refSchemaName,
              fieldNames,
              relation: '1',
            },
          ],
          onDelete,
          onUpdate,
        },
      };
    }

    if (ctx.DEFAULT()) {
      const column = ctx.column.accept(this);
      const expression = ctx.expression().accept(this);
      return {
        kind: TABLE_CONSTRAINT_KIND.DEFAULT,
        value: {
          name,
          column,
          defaultValue: expression,
        },
      };
    }

    return null;
  }

  // column_name_list_with_order
  //   : id_ (ASC | DESC)? (',' id_ (ASC | DESC)?)*
  //   ;
  visitColumn_name_list_with_order (ctx) {
    return ctx.id_().map((id) => ({
      value: id.accept(this),
      type: 'column',
    }));
  }

  // table_indices
  //   : INDEX id_ UNIQUE? clustered? '(' column_name_list_with_order ')'
  //   | INDEX id_ CLUSTERED COLUMNSTORE
  //   | INDEX id_ NONCLUSTERED? COLUMNSTORE '(' column_name_list ')' create_table_index_options? (
  //       ON id_
  //   )?
  //   ;
  visitTable_indices (ctx) {
    const index = new Index({
      name: ctx.id_().map((id) => id.accept(this))[0],
      unique: !!ctx.UNIQUE(),
      columns: ctx.column_name_list_with_order().accept(this),
    });

    return index;
  }
}
