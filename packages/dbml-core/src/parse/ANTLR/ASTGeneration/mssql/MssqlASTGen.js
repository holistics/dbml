import {
  first, flatten, flattenDepth, last, nth,
} from 'lodash';
import TSqlParserVisitor from '../../parsers/mssql/TSqlParserVisitor';
import { COLUMN_CONSTRAINT_KIND, DATA_TYPE, TABLE_CONSTRAINT_KIND } from '../constants';
import { getOriginalText } from '../helpers';
import {
  Field, Index, Table, TableRecord,
} from '../AST';

const ADD_DESCRIPTION_FUNCTION_NAME = 'sp_addextendedproperty';

const getSchemaAndTableName = (names) => {
  const tableName = last(names);
  const schemaName = names.length > 1 ? nth(names, -2) : undefined;
  return {
    schemaName,
    tableName,
  };
};

const getStringFromRawString = (rawString) => {
  if (rawString.startsWith("N'")) {
    return rawString;
  }

  return rawString.slice(1, rawString.length - 1);
};

/**
 * @param {any[]} columnDefTableConstraints
 * @returns {{
 *  fieldsData: any[],
 *  indexes: any[],
 *  tableRefs: any[],
 *  columnDefaults: any[],
 *  checkConstraints: any[],
 * }}
 */
const splitColumnDefTableConstraints = (columnDefTableConstraints) => {
  const [fieldsData, indexes, tableRefs, columnDefaults, checkConstraints] = columnDefTableConstraints.reduce((acc, columnDefTableConstraint) => {
    switch (columnDefTableConstraint.kind) {
      case TABLE_CONSTRAINT_KIND.FIELD:
        acc[0].push(columnDefTableConstraint.value);
        break;

      case TABLE_CONSTRAINT_KIND.INDEX:
      case TABLE_CONSTRAINT_KIND.PK:
      case TABLE_CONSTRAINT_KIND.UNIQUE:
        acc[1].push(columnDefTableConstraint.value);
        break;

      case TABLE_CONSTRAINT_KIND.FK:
        acc[2].push(columnDefTableConstraint.value);
        break;

      case TABLE_CONSTRAINT_KIND.DEFAULT:
        acc[3].push(columnDefTableConstraint.value);
        break;

      case TABLE_CONSTRAINT_KIND.CHECK:
        acc[4].push(columnDefTableConstraint.value);
        break;

      default:
        break;
    }

    return acc;
  }, [[], [], [], [], []]);

  return {
    fieldsData,
    indexes,
    tableRefs,
    columnDefaults,
    checkConstraints,
  };
};

const parseFieldsAndInlineRefsFromFieldsData = (fieldsData, tableName, schemaName) => {
  const [resInlineRefs, fields] = fieldsData.reduce((acc, fieldData) => {
    const inlineRefs = fieldData.inline_refs.map((inlineRef) => {
      inlineRef.endpoints[0].tableName = tableName;
      inlineRef.endpoints[0].schemaName = schemaName;
      inlineRef.endpoints[0].fieldNames = [fieldData.field.name];
      return inlineRef;
    });

    acc[0].push(inlineRefs);
    acc[1].push(fieldData.field);
    return acc;
  }, [[], [], []]);

  return { inlineRefs: resInlineRefs, fields };
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
      records: [],
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
      return;
    }

    if (ctx.another_statement()) {
      ctx.another_statement().accept(this);
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

    const record = new TableRecord({
      tableName,
      schemaName,
      columns,
      values,
    });

    this.data.records.push(record);
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

    if (ctx.bracket_expression()) {
      return ctx.bracket_expression().accept(this);
    }

    if (ctx.full_column_name()) {
      return ctx.full_column_name().accept(this);
    }

    // Default case for any other expression type
    return {
      value: getOriginalText(ctx),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  // bracket_expression
  //   : '(' expression ')'
  //   | '(' subquery ')'
  //   ;
  visitBracket_expression (ctx) {
    return ctx.expression() ? ctx.expression().accept(this) : null;
  }

  // full_column_name
  //   : ((DELETED | INSERTED | full_table_name) '.')? (
  //       column_name = id_
  //       | ('$' (IDENTITY | ROWGUID))
  //   )
  //   ;
  visitFull_column_name (ctx) {
    const columnName = ctx.id_().accept(this);
    const fullTableName = ctx.full_table_name() ? ctx.full_table_name().accept(this) : [];

    return {
      value: [...fullTableName, columnName],
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
      const value = getStringFromRawString(ctx.getText());
      return {
        value,
        type: value.startsWith("N'") ? DATA_TYPE.EXPRESSION : DATA_TYPE.STRING,
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
      value: getOriginalText(ctx),
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

  visitSCALAR_FUNCTION (ctx) {
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
    if (ctx.MAX()) {
      let type = '';
      if (ctx.SQUARE_BRACKET_ID()) {
        type = ctx.SQUARE_BRACKET_ID().getText().slice(1, -1);
      } else {
        const typeNode = ctx.VARCHAR() || ctx.NVARCHAR() || ctx.BINARY_KEYWORD() || ctx.VARBINARY_KEYWORD() || ctx.SQUARE_BRACKET_ID();
        type = typeNode.getText();
      }
      return `${type}(MAX)`;
    }

    if (ctx.DOUBLE()) {
      const double = ctx.DOUBLE().getText();
      const precision = ctx.PRECISION() ? ` ${ctx.PRECISION().getText()}` : '';

      return `${double}${precision}`;
    }

    const id = ctx.id_().accept(this);

    if (ctx.IDENTITY()) {
      if (ctx.DECIMAL().length) {
        const seedAndInc = ctx.DECIMAL().map((decimal) => decimal.getText());
        return `${id} IDENTITY(${seedAndInc})`;
      }

      return `${id} IDENTITY`;
    }

    if (ctx.DECIMAL().length) {
      const scaleAndPrec = ctx.DECIMAL().map((decimal) => decimal.getText());
      return `${id}(${scaleAndPrec.join(',')})`;
    }

    return id;
  }

  visitPrimitive_expression (ctx) {
    if (ctx.NULL_()) {
      return {
        value: ctx.getText(),
        type: DATA_TYPE.BOOLEAN,
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

    const {
      fieldsData, indexes, tableRefs, checkConstraints: tableCheckConstraints,
    } = splitColumnDefTableConstraints(columnDefTableConstraints);

    const { inlineRefs, fields } = parseFieldsAndInlineRefsFromFieldsData(fieldsData, tableName, schemaName);

    this.data.refs.push(...flatten(inlineRefs));

    this.data.refs.push(...tableRefs.map((tableRef) => {
      tableRef.endpoints[0].tableName = tableName;
      tableRef.endpoints[0].schemaName = schemaName;
      return tableRef;
    }));

    const table = new Table({
      name: tableName,
      schemaName,
      fields,
      indexes: tableIndices.concat(indexes),
      checks: tableCheckConstraints,
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
        schemaName: null,
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
          case COLUMN_CONSTRAINT_KIND.INCREMENT:
            field.increment = columnDef.value;
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
          case COLUMN_CONSTRAINT_KIND.CHECK: {
            const { expression, name } = columnDef.value;
            if (!field.checks) {
              field.checks = [];
            }
            const checkObj = { expression };
            if (name) {
              checkObj.name = name;
            }
            field.checks.push(checkObj);
            break;
          }
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

    if (ctx.IDENTITY()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.INCREMENT,
        value: true,
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

    if (ctx.check_constraint()) {
      const constraintName = ctx.id_() ? ctx.id_().accept(this) : null;
      const checkConstraintResult = ctx.check_constraint().accept(this);

      return {
        kind: COLUMN_CONSTRAINT_KIND.CHECK,
        value: {
          ...checkConstraintResult,
          name: constraintName,
        },
      };
    }

    return null;
  }

  // check_constraint
  //   : CHECK (NOT FOR REPLICATION)? '(' search_condition ')'
  //   ;
  visitCheck_constraint (ctx) {
    return ctx.search_condition().accept(this);
  }

  // search_condition
  //   : NOT* (predicate | '(' search_condition ')')
  //   | search_condition AND search_condition // AND takes precedence over OR
  //   | search_condition OR search_condition
  //   ;
  visitSearch_condition (ctx) {
    return {
      expression: getOriginalText(ctx),
    };
  }

  // predicate
  //   : EXISTS '(' subquery ')'
  //   | freetext_predicate
  //   | expression comparison_operator expression
  //   | expression MULT_ASSIGN expression ////SQL-82 syntax for left outer joins; '*='. See https://stackoverflow.com/questions/40665/in-sybase-sql
  //   | expression comparison_operator (ALL | SOME | ANY) '(' subquery ')'
  //   | expression NOT* BETWEEN expression AND expression
  //   | expression NOT* IN '(' (subquery | expression_list_) ')'
  //   | expression NOT* LIKE expression (ESCAPE expression)?
  //   | expression IS null_notnull
  //   ;
  visitPredicate (ctx) {
    if (ctx.IN() && ctx.expression_list_() && ctx.NOT().length === 0) {
      const [expression = {}] = ctx.expression().map((e) => e.accept(this));

      // {
      //   value: [ 'myschema', 'sample_table', 'column_name' ],
      //   type: 'expression'
      // }
      const column = last(expression.value ?? []);
      const expressionList = ctx.expression_list_().accept(this).map((e) => e.value);
      return {
        column,
        columnValues: expressionList,
      };
    }

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

      const index = new Index({
        name,
        columns,
      });

      if (ctx.PRIMARY()) {
        index.pk = true;
      }

      if (ctx.UNIQUE()) {
        index.unique = true;
      }

      return {
        kind: ctx.PRIMARY() ? TABLE_CONSTRAINT_KIND.PK : TABLE_CONSTRAINT_KIND.UNIQUE,
        value: index,
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
          column,
          defaultValue: expression,
        },
      };
    }

    if (ctx.check_constraint()) {
      const checkConstraint = ctx.check_constraint().accept(this);

      return {
        kind: TABLE_CONSTRAINT_KIND.CHECK,
        value: {
          expression: checkConstraint.expression,
          name,
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

  // alter_table
  //   : ALTER TABLE table_name (
  //       SET '(' LOCK_ESCALATION '=' (AUTO | TABLE | DISABLE) ')'
  //       | ADD column_def_table_constraints
  //       | ALTER COLUMN (column_definition | column_modifier)
  //       | DROP COLUMN id_ (',' id_)*
  //       | DROP CONSTRAINT constraint = id_
  //       | WITH (CHECK | NOCHECK) ADD (CONSTRAINT constraint = id_)? (
  //           FOREIGN KEY '(' fk = column_name_list ')' REFERENCES table_name (
  //               '(' pk = column_name_list ')'
  //           )? (on_delete | on_update)*
  //           | CHECK '(' search_condition ')'
  //       )
  //       | (NOCHECK | CHECK) CONSTRAINT constraint = id_
  //       | (ENABLE | DISABLE) TRIGGER id_?
  //       | REBUILD table_options
  //       | SWITCH switch_partition
  //   ) ';'?
  //   ;
  visitAlter_table (ctx) {
    // table_name() returns an array because there are multiple table_name in the clause (REFERENCES table_name ...)
    const names = ctx.table_name()[0].accept(this);
    const { schemaName, tableName } = getSchemaAndTableName(names);

    const table = this.data.tables.find((t) => t.name === tableName && t.schemaName === schemaName);
    if (!table) return; // ALTER TABLE should appear after CREATE TABLE, so skip if table is not created yet

    const columnDefTableConstraints = ctx.column_def_table_constraints() ? ctx.column_def_table_constraints().accept(this) : [];
    const {
      fieldsData, indexes, tableRefs, columnDefaults, checkConstraints,
    } = splitColumnDefTableConstraints(columnDefTableConstraints);

    const { inlineRefs, fields } = parseFieldsAndInlineRefsFromFieldsData(fieldsData, tableName, schemaName);
    this.data.refs.push(...flatten(inlineRefs));

    this.data.refs.push(...tableRefs.map((tableRef) => {
      tableRef.endpoints[0].tableName = tableName;
      tableRef.endpoints[0].schemaName = schemaName;
      return tableRef;
    }));

    table.fields.push(...fields);
    table.indexes.push(...indexes);

    columnDefaults.forEach((columnDefault) => {
      const field = table.fields.find((f) => f.name === columnDefault.column);

      if (!field) return;
      field.dbdefault = columnDefault.defaultValue;
    });

    checkConstraints.forEach((checkConstraint) => {
      const checkObj = { expression: checkConstraint.expression };
      if (checkConstraint.name) {
        checkObj.name = checkConstraint.name;
      }
      table.checks.push(checkObj);
    });

    // Handle WITH CHECK/NOCHECK ADD CONSTRAINT FK
    if (ctx.WITH() && ctx.FOREIGN()) {
      const constraintName = ctx.constraint ? ctx.constraint.accept(this) : '';
      const localColumns = ctx.fk.accept(this);

      // table_name()[1] is the referenced table (table_name()[0] is the table being altered)
      const refTableNames = ctx.table_name()[1].accept(this);
      const { schemaName: refSchemaName, tableName: refTableName } = getSchemaAndTableName(refTableNames);

      // pk is optional - if not specified, assume same column names as fk
      const refColumns = ctx.pk ? ctx.pk.accept(this) : localColumns;

      const onDelete = ctx.on_delete().length > 0 ? ctx.on_delete()[0].accept(this) : null;
      const onUpdate = ctx.on_update().length > 0 ? ctx.on_update()[0].accept(this) : null;

      const ref = {
        name: constraintName,
        endpoints: [
          {
            tableName,
            schemaName,
            fieldNames: localColumns,
            relation: '*',
          },
          {
            tableName: refTableName,
            schemaName: refSchemaName,
            fieldNames: refColumns,
            relation: '1',
          },
        ],
        onDelete,
        onUpdate,
      };

      this.data.refs.push(ref);
    }
  }

  // create_index
  //   : CREATE UNIQUE? clustered? INDEX id_ ON table_name '(' column_name_list_with_order ')' (
  //       INCLUDE '(' column_name_list ')'
  //   )? (WHERE where = search_condition)? (create_index_options)? (ON id_)? ';'?
  //   ;
  visitCreate_index (ctx) {
    const { schemaName, tableName } = getSchemaAndTableName(ctx.table_name().accept(this));
    const table = this.data.tables.find((t) => t.name === tableName && t.schemaName === schemaName);
    if (!table) return; // ALTER TABLE should appear after CREATE TABLE, so skip if table is not created yet

    const index = new Index({
      name: ctx.id_()[0].accept(this),
      unique: !!ctx.UNIQUE(),
      columns: ctx.column_name_list_with_order().accept(this),
    });

    table.indexes.push(index);
  }

  // another_statement
  //   : alter_queue
  //   | checkpoint_statement
  //   | conversation_statement
  //   | create_contract
  //   | create_queue
  //   | cursor_statement
  //   | declare_statement
  //   | execute_statement
  //   | kill_statement
  //   | message_statement
  //   | reconfigure_statement
  //   | security_statement
  //   | set_statement
  //   | setuser_statement
  //   | shutdown_statement
  //   | transaction_statement
  //   | use_statement
  //   ;
  visitAnother_statement (ctx) {
    if (ctx.execute_statement()) {
      ctx.execute_statement().accept(this);
    }
  }

  // execute_statement
  //   : EXECUTE execute_body ';'?
  //   ;
  visitExecute_statement (ctx) {
    ctx.execute_body().accept(this);
  }

  // execute_body
  //   : (return_status = LOCAL_ID '=')? (func_proc_name_server_database_schema | execute_var_string) execute_statement_arg?
  //   | '(' execute_var_string (',' execute_var_string)* ')' (AS (LOGIN | USER) '=' STRING)? (
  //       AT_KEYWORD linkedServer = id_
  //   )?
  //   | AS ( (LOGIN | USER) '=' STRING | CALLER)
  //   ;
  visitExecute_body (ctx) {
    const funcNames = ctx.func_proc_name_server_database_schema() ? ctx.func_proc_name_server_database_schema().accept(this) : [];
    const funcName = last(funcNames);

    if (funcName !== ADD_DESCRIPTION_FUNCTION_NAME) {
      return;
    }

    if (ctx.execute_statement_arg()) {
      // [
      //   { name: '@name', value: "N'Column_Description'", type: 'expression' },
      //   { name: '@value', value: '$-1', type: 'string' },
      //   { name: '@level0type', value: "N'Schema'", type: 'expression' },
      //   { name: '@level0name', value: 'dbo', type: 'string' },
      //   { name: '@level1type', value: "N'Table'", type: 'expression' },
      //   { name: '@level1name', value: 'orders', type: 'string' },
      //   { name: '@level2type', value: "N'Column'", type: 'expression' },
      //   { name: '@level2name', value: 'status', type: 'string' }
      // ]
      const args = ctx.execute_statement_arg().accept(this);

      // {
      //   name: "N'Table_Description'",
      //   value: 'This is a note in table "orders"',
      //   level0type: "N'Schema'",
      //   level0name: 'dbo',
      //   level1type: "N'Table'",
      //   level1name: 'orders'
      // }
      const argsObj = args.reduce((acc, arg) => {
        const name = arg.name.slice(1);
        acc[name] = arg.value;
        return acc;
      }, {});

      if (!argsObj.name.includes('Description')) {
        return;
      }

      // https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-addextendedproperty-transact-sql?view=sql-server-ver16#----level0type
      const level0Type = argsObj.level0type.toLowerCase();

      if (!level0Type.includes('schema')) return;

      const schemaName = argsObj.level0name !== 'dbo' ? argsObj.level0name : undefined;

      const level1Type = argsObj.level1type.toLowerCase();
      const tableName = level1Type.includes('table') ? argsObj.level1name : null;

      const table = this.data.tables.find((t) => t.name === tableName && t.schemaName === schemaName);
      if (!table) return;

      if (!argsObj.level2type) {
        table.note = {
          value: argsObj.value,
        };

        return;
      }

      const level2Type = argsObj.level2type.toLowerCase();
      const columnName = level2Type.includes('column') ? argsObj.level2name : null;
      const field = table.fields.find((f) => f.name === columnName);
      if (!field) return;

      field.note = {
        value: argsObj.value,
      };
    }
  }

  // func_proc_name_server_database_schema
  //   : server = id_? '.' database = id_? '.' schema = id_? '.' procedure = id_
  //   | func_proc_name_database_schema
  //   ;
  visitFunc_proc_name_server_database_schema (ctx) {
    if (ctx.func_proc_name_database_schema()) {
      return ctx.func_proc_name_database_schema().accept(this);
    }

    return ctx.id_().map((id) => id.accept(this));
  }

  // func_proc_name_database_schema
  //   : database = id_? '.' schema = id_? '.' procedure = id_
  //   | func_proc_name_schema
  //   ;
  visitFunc_proc_name_database_schema (ctx) {
    if (ctx.func_proc_name_schema()) {
      return ctx.func_proc_name_schema().accept(this);
    }
    return ctx.id_().map((id) => id.accept(this));
  }

  // func_proc_name_schema
  //   : ((schema = id_) '.')? procedure = id_
  //   ;
  visitFunc_proc_name_schema (ctx) {
    return ctx.id_().map((id) => id.accept(this));
  }

  // execute_statement_arg
  //   : execute_statement_arg_unnamed (',' execute_statement_arg)*     //Unnamed params can continue unnamed
  //   | execute_statement_arg_named (',' execute_statement_arg_named)* //Named can only be continued by unnamed
  //   ;
  visitExecute_statement_arg (ctx) {
    if (ctx.execute_statement_arg_unnamed()) {
      return ctx.execute_statement_arg_unnamed().map((item) => item.accept(this));
    }

    return ctx.execute_statement_arg_named().map((item) => item.accept(this));
  }

  // execute_statement_arg_named
  //   : name = LOCAL_ID '=' value = execute_parameter
  //   ;
  visitExecute_statement_arg_named (ctx) {
    const { value, type } = ctx.execute_parameter().accept(this);
    return {
      name: ctx.LOCAL_ID().getText(),
      value,
      type,
    };
  }

  // execute_parameter
  //   : (constant | LOCAL_ID (OUTPUT | OUT)? | id_ | DEFAULT | NULL_)
  //   ;
  visitExecute_parameter (ctx) {
    if (ctx.constant()) {
      return ctx.constant().accept(this);
    }

    return ctx.getText();
  }

  // constant
  //   : STRING // string, datetime or uniqueidentifier
  //   | BINARY
  //   | '-'? (DECIMAL | REAL | FLOAT)                    // float or decimal
  //   | '-'? dollar = '$' ('-' | '+')? (DECIMAL | FLOAT) // money
  //   | parameter
  //   ;
  visitConstant (ctx) {
    if (ctx.STRING() || ctx.BINARY()) {
      const value = getStringFromRawString(ctx.getText());

      return {
        value,
        type: value.startsWith("N'") ? DATA_TYPE.EXPRESSION : DATA_TYPE.STRING,
      };
    }

    if (ctx.DOLLAR()) {
      const value = ctx.getText();
      return {
        value,
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
      value: getOriginalText(ctx),
      type: DATA_TYPE.EXPRESSION,
    };
  }
}
