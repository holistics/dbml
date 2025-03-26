import { first, flattenDepth, last, nth } from 'lodash';
import { shouldPrintSchemaName } from '../../../../model_structure/utils';
import TSqlParserVisitor from '../../parsers/mssql/TSqlParserVisitor';
import { DATA_TYPE } from '../constants';
import { getOriginalText } from '../helpers';

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

    const columns = ctx.insert_column_name_list()?.accept(this) || [];
    const values = ctx.insert_statement_value().accept(this);

    // handle insert into all columns
    if (columns.length === 0 || values.length === 0) {
      // temporarily ignore
      return;
    }

    const fullTableName = `${schemaName && shouldPrintSchemaName(schemaName) ? `${schemaName}.` : ''}${tableName}`;

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
      type: DATA_TYPE.EXPRESSION
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
      return {
        value: ctx.getText(),
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
      }
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
    }
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
      type: expression.type
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
    return ctx.getText();
  }

  visitPrimitive_expression (ctx) {
    if (ctx.NULL_()) {
      return {
        value: 'NULL',
        type: DATA_TYPE.NUMBER
      };
    }

    if (ctx.primitive_constant()) {
      return ctx.primitive_constant().accept(this);
    }

    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION
    };
  }
}
