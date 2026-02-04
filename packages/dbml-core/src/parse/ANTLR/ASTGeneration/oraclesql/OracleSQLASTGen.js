import { last, flatten } from 'lodash-es';
import {
  Field,
  Index,
  Table,
  TableRecord,
  Ref,
  Endpoint,
} from '../AST';
import {
  DATA_TYPE,
  CONSTRAINT_TYPE,
} from '../constants';
import { getOriginalText } from '../helpers';
import { CompilerError } from '../../../error';
import OracleSqlParserVisitor from '../../parsers/oraclesql/OracleSqlParserVisitor';

// We cannot use TABLE_CONSTRAINT_KIND and COLUMN_CONSTRAINT_KIND from '../constants' as their values are indistinguishable from each other
// For example: TABLE_CONSTRAINT_KIND.UNIQUE === COLUMN_CONSTRAINT_KIND.UNIQUE
// Therefore, we redefine them to be different
// TODO: Migrate the other parser to use our version instead
const TABLE_CONSTRAINT_KIND = {
  FIELD: 'table_field',
  INDEX: 'table_index',
  FK: 'table_fk',
  UNIQUE: 'table_unique',
  PK: 'table_pk',
  DEFAULT: 'table_default',
  CHECK: 'table_check',
};
const COLUMN_CONSTRAINT_KIND = {
  NOT_NULL: 'col_not_null',
  NULLABLE: 'col_nullable',
  UNIQUE: 'col_unique',
  PK: 'col_pk',
  DEFAULT: 'col_dbdefault',
  INCREMENT: 'col_increment',
  INLINE_REF: 'col_inline_ref',
  NOTE: 'col_note',
  CHECK: 'col_check',
};

const findTable = (tables, schemaName, tableName) => {
  const realSchemaName = schemaName || null;
  const table = tables.find((table) => {
    const targetSchemaName = table.schemaName || null;
    return targetSchemaName === realSchemaName && table.name === tableName;
  });
  return table;
};

const findColumn = (table, columnName) => {
  const column = table.fields.find((field) => field.name === columnName);
  return column;
};

// `e` is the value returned by `visitExpression`
const processDefaultExpression = (e) => ({
  value: e.type !== CONSTRAINT_TYPE.COLUMN ? e.value : e.rawValue,
  type: e.type !== CONSTRAINT_TYPE.COLUMN ? e.type : DATA_TYPE.EXPRESSION,
});

// `e` is the value returned by `visitExpression`
const processIndexExpression = (e) => {
  let type;
  switch (e.type) {
    case CONSTRAINT_TYPE.COLUMN:
      type = CONSTRAINT_TYPE.COLUMN;
      break;
    case DATA_TYPE.STRING:
      type = CONSTRAINT_TYPE.STRING;
      break;
    default:
      type = CONSTRAINT_TYPE.EXPRESSION;
      break;
  }
  return {
    value: e.value.toString(),
    type,
  };
};

const createCompilerError = (ctx, message) => {
  return CompilerError.create([{
    message,
    location: {
      start: {
        line: ctx.start.line,
        column: ctx.start.column + 1,
      },
      end: {
        line: ctx.stop.line,
        column: ctx.stop.column + getOriginalText(ctx).length + 1,
      },
    },
  }]);
};

const unquoteString = (str, quoteChar = '"') => {
  return !str.startsWith(quoteChar)
    ? str
    : str
        .slice(1, -1) // Strip off starting and ending quotes
        .replaceAll(`${quoteChar}${quoteChar}`, quoteChar); // Unescape quotes, in Oracle, quotes are escaped by doubling it
};

// Only methods for rules representing whole statements can mutate `data`:
//   * create_table
//   * alter_table
//   * create_index
//   * insert_statement
// All other methods must be pure
export default class OracleSqlASTGen extends OracleSqlParserVisitor {
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

  //  sql_script
  //  : sql_plus_command_no_semicolon? (
  //      (((sql_plus_command SEMICOLON? '/'?) | (unit_statement SEMICOLON '/'?))* (sql_plus_command | unit_statement)) SEMICOLON? '/'?
  //  )? EOF
  //  ;
  visitSql_script (ctx) {
    ctx.unit_statement()?.forEach((stmt) => stmt.accept(this));
    return this.data;
  }

  // unit_statement
  //   : create_table
  //   | comment_on_table
  //   | comment_on_column
  //   | alter_table
  //   | create_index
  //   | data_manipulation_language_statements
  //   | <other rules>
  //   ;
  visitUnit_statement (ctx) {
    if (ctx.create_table()) {
      ctx.create_table().accept(this);
    } else if (ctx.comment_on_table()) {
      ctx.comment_on_table().accept(this);
    } else if (ctx.comment_on_column()) {
      ctx.comment_on_column().accept(this);
    } else if (ctx.alter_table()) {
      ctx.alter_table().accept(this);
    } else if (ctx.create_index()) {
      ctx.create_index().accept(this);
    } else if (ctx.data_manipulation_language_statements()) {
      ctx.data_manipulation_language_statements().accept(this);
    }
  }

  // data_manipulation_language_statements
  //   : insert_statement
  //   | <other rules>
  //   ;
  visitData_manipulation_language_statements (ctx) {
    if (ctx.insert_statement()) {
      ctx.insert_statement().accept(this);
    }
  }

  // create_table
  //   : CREATE TABLE (schema_name '.')? table_name
  //       (relational_table | <other rules>)
  //   | <other rules>
  //   ;
  visitCreate_table (ctx) {
    const tableName = ctx.table_name().accept(this);
    const schemaName = ctx.schema_name() ? ctx.schema_name().accept(this) : undefined;

    if (ctx.relational_table()) {
      const tableElements = ctx.relational_table().accept(this);
      const [fieldsData, indexes, tableRefs, tableChecks] = tableElements.reduce((acc, ele) => {
        if (ele.type === TABLE_CONSTRAINT_KIND.FIELD) acc[0].push(ele.value);
        else if ([TABLE_CONSTRAINT_KIND.INDEX, TABLE_CONSTRAINT_KIND.UNIQUE, TABLE_CONSTRAINT_KIND.PK].includes(ele.type)) acc[1].push(ele.value);
        else if (ele.type === TABLE_CONSTRAINT_KIND.FK) acc[2].push(ele.value);
        else if (ele.type === TABLE_CONSTRAINT_KIND.CHECK) acc[3].push(...ele.value.checks);
        return acc;
      }, [[], [], [], []]);

      this.data.refs.push(...flatten(
        fieldsData.map((fieldData) => fieldData.inline_refs.map((inlineRef) => {
          inlineRef.endpoints[0].tableName = tableName;
          inlineRef.endpoints[0].schemaName = schemaName;
          inlineRef.endpoints[0].fieldNames = [fieldData.field.name];
          return inlineRef;
        })),
      ));

      this.data.refs.push(...tableRefs.map((tableRef) => {
        tableRef.endpoints[0].tableName = tableName;
        tableRef.endpoints[0].schemaName = schemaName;
        return tableRef;
      }));

      this.data.tables.push(new Table({
        name: tableName,
        schemaName,
        fields: fieldsData.map((fd) => fd.field),
        indexes,
        checks: tableChecks,
      }));
    }
  }

  //  relational_table
  //  : ('(' relational_property (',' relational_property)* ')')? relational_table_properties?
  //  ;
  visitRelational_table (ctx) {
    if (ctx.relational_property()) {
      return ctx.relational_property().map((p) => p.accept(this));
    }
    return [];
  }

  // relational_property
  //   : column_definition
  //   | out_of_line_constraint
  //   | out_of_line_ref_constraint
  //   | <other rules>
  //   ;
  visitRelational_property (ctx) {
    if (ctx.column_definition()) {
      return ctx.column_definition().accept(this);
    }
    if (ctx.out_of_line_constraint()) {
      return ctx.out_of_line_constraint().accept(this);
    }
    if (ctx.out_of_line_ref_constraint()) {
      return ctx.out_of_line_ref_constraint().accept(this);
    }
    return null;
  }

  // column_definition
  //   : column_name ((datatype | type_name) (COLLATE column_collation_name)?)? SORT? (
  //       VISIBLE
  //       | INVISIBLE
  //   )? (DEFAULT (ON NULL_)? expression | identity_clause)? (ENCRYPT encryption_spec)? (
  //       inline_constraint+
  //       | inline_ref_constraint
  //   )? annotations_clause?
  //   ;
  visitColumn_definition (ctx) {
    const name = last(ctx.column_name().accept(this));
    const type = ctx.datatype()?.accept(this) || ctx.type_name()?.accept(this);
    if (!type) throw createCompilerError(ctx, 'Importing a column definition without a type is not supported');
    const constraints = (ctx.inline_constraint() || []).map((c) => c.accept(this)).filter(Boolean);
    if (ctx.DEFAULT()) {
      const value = ctx.expression().accept(this);
      constraints.push({
        type: COLUMN_CONSTRAINT_KIND.DEFAULT,
        value: {
          dbdefault: processDefaultExpression(value),
        },
      });
    }
    if (ctx.identity_clause()) {
      constraints.push({
        type: COLUMN_CONSTRAINT_KIND.INCREMENT,
        value: {
          increment: true,
        },
      });
    }

    const settings = { checks: [], inline_refs: [] };
    constraints.forEach((constraint) => {
      switch (constraint.type) {
        case COLUMN_CONSTRAINT_KIND.DEFAULT:
          settings.dbdefault = constraint.value.dbdefault;
          break;
        case COLUMN_CONSTRAINT_KIND.NOT_NULL:
          settings.not_null = true;
          break;
        case COLUMN_CONSTRAINT_KIND.NULLABLE:
          settings.not_null = false;
          break;
        case COLUMN_CONSTRAINT_KIND.PK:
          settings.pk = true;
          break;
        case COLUMN_CONSTRAINT_KIND.UNIQUE:
          settings.unique = true;
          break;
        case COLUMN_CONSTRAINT_KIND.CHECK:
          settings.checks.push(...constraint.value.checks);
          break;
        case COLUMN_CONSTRAINT_KIND.INCREMENT:
          settings.increment = true;
          break;
        case COLUMN_CONSTRAINT_KIND.FK:
          settings.inline_refs.push(...constraint.value.inline_refs);
          break;
        default:
      }
    });
    const field = new Field({
      name,
      type,
      ...settings,
    });

    return {
      type: TABLE_CONSTRAINT_KIND.FIELD,
      value: {
        field,
        inline_refs: settings.inline_refs || [],
      },
    };
  }

  // inline_constraint
  //   : constraint_name? (
  //       NOT? NULL_
  //       | (UNIQUE | PRIMARY) KEY?
  //       | references_clause
  //       | check_constraint
  //   ) constraint_state?
  //   ;
  visitInline_constraint (ctx) {
    if (ctx.NULL_() && ctx.NOT()) {
      return {
        type: COLUMN_CONSTRAINT_KIND.NOT_NULL,
        value: {
          not_null: true,
        },
      };
    }
    if (ctx.NULL_()) {
      return {
        type: COLUMN_CONSTRAINT_KIND.NULLABLE,
        value: {
          not_null: false,
        },
      };
    }
    if (ctx.UNIQUE()) {
      return {
        type: COLUMN_CONSTRAINT_KIND.UNIQUE,
        value: {
          unique: true,
        },
      };
    }
    if (ctx.PRIMARY()) {
      return {
        type: COLUMN_CONSTRAINT_KIND.PK,
        value: {
          pk: true,
        },
      };
    }
    const name = ctx.constraint_name()?.accept(this);
    if (ctx.references_clause()) {
      const ref = ctx.references_clause().accept(this);
      ref.name = name;
      return {
        type: COLUMN_CONSTRAINT_KIND.FK,
        value: {
          inline_refs: [ref],
        },
      };
    }
    if (ctx.check_constraint()) {
      const checkCtx = ctx.check_constraint();
      checkCtx.isColumn = true;
      const check = checkCtx.accept(this);
      check.value.checks[0].name = name;
      return check;
    }
    return null;
  }

  //  out_of_line_constraint
  //  : (
  //      ((CONSTRAINT | CONSTRAINTS) constraint_name)? (
  //          UNIQUE '(' column_name (',' column_name)* ')'
  //          | PRIMARY KEY '(' column_name (',' column_name)* ')'
  //          | foreign_key_clause
  //          | CHECK '(' condition ')'
  //      )
  //  )
  //  constraint_state?
  //  parallel_clause?
  //  ;
  visitOut_of_line_constraint (ctx) {
    if (ctx.UNIQUE()) {
      const columns = ctx.column_name().map((c) => ({ value: last(c.accept(this)), type: CONSTRAINT_TYPE.COLUMN }));
      return {
        type: TABLE_CONSTRAINT_KIND.UNIQUE,
        value: new Index({
          columns,
          unique: true,
          name: ctx.constraint_name()?.accept(this),
        }),
      };
    }
    if (ctx.PRIMARY()) {
      const columns = ctx.column_name().map((c) => ({ value: last(c.accept(this)), type: CONSTRAINT_TYPE.COLUMN }));
      return {
        type: TABLE_CONSTRAINT_KIND.PK,
        value: new Index({
          columns,
          pk: true,
          name: ctx.constraint_name()?.accept(this),
        }),
      };
    }
    if (ctx.foreign_key_clause()) {
      const ref = ctx.foreign_key_clause().accept(this);
      ref.value.name = ctx.constraint_name()?.accept(this);
      return ref;
    }
    if (ctx.condition()) {
      const expression = getOriginalText(ctx.condition());
      return {
        type: TABLE_CONSTRAINT_KIND.CHECK,
        value: {
          checks: [
            {
              name: ctx.constraint_name()?.accept(this),
              expression,
            },
          ],
        },
      };
    }
    return null;
  }

  // out_of_line_ref_constraint
  // : (CONSTRAINT constraint_name)? FOREIGN KEY '(' (','? ref_col_or_attr = regular_id)+ ')' references_clause constraint_state?
  // | <other rules>
  // ;
  visitOut_of_line_ref_constraint (ctx) {
    const refName = ctx.constraint_name()?.accept(this);
    const firstFieldNames = ctx.regular_id().map((c) => c.accept(this));
    const ref = ctx.references_clause().accept(this);
    ref.endpoints[0].fieldNames = firstFieldNames;
    if (refName) {
      ref.name = refName;
    }
    return {
      type: TABLE_CONSTRAINT_KIND.FK,
      value: ref,
    };
  }

  // foreign_key_clause
  //  : FOREIGN KEY paren_column_list references_clause on_delete_clause?
  //  ;
  visitForeign_key_clause (ctx) {
    const firstFieldNames = ctx.paren_column_list().accept(this).map((c) => last(c));
    const ref = ctx.references_clause().accept(this);
    ref.endpoints[0].fieldNames = firstFieldNames;
    if (ctx.on_delete_clause()) {
      ref.onDelete = ctx.on_delete_clause().accept(this);
    }
    return {
      type: TABLE_CONSTRAINT_KIND.FK,
      value: ref,
    };
  }

  //  references_clause
  //  : REFERENCES tableview_name paren_column_list? (ON DELETE (CASCADE | SET NULL_))?
  //  ;
  visitReferences_clause (ctx) {
    if (!ctx.paren_column_list()) throw createCompilerError(ctx.tableview_name(), 'Importing a foreign key with implicit referenced columns is not supported');
    const names = ctx.tableview_name().accept(this);
    const refTableName = last(names);
    const refSchemaName = names.length > 1 ? names[names.length - 2] : undefined;
    const secondFieldNames = ctx.paren_column_list().accept(this).map((c) => last(c));

    return new Ref({
      endpoints: [
        new Endpoint({
          tableName: null,
          schemaName: null,
          fieldNames: [],
          relation: '*',
        }),
        new Endpoint({
          tableName: refTableName,
          schemaName: refSchemaName,
          fieldNames: secondFieldNames,
          relation: '1',
        }),
      ],
    });
  }

  // on_delete_clause
  //   : ON DELETE (CASCADE | SET NULL_)
  //   ;
  visitOn_delete_clause (ctx) {
    if (ctx.CASCADE()) return 'cascade';
    if (ctx.SET() && ctx.NULL_()) return 'set null';
    return null;
  }

  // check_constraint
  //   : CHECK '(' condition ')'
  //   ;
  visitCheck_constraint (ctx) {
    const expression = getOriginalText(ctx.condition());
    return {
      type: ctx.isColumn ? COLUMN_CONSTRAINT_KIND.CHECK : TABLE_CONSTRAINT_KIND.CHECK,
      value: {
        checks: [
          {
            expression,
          },
        ],
      },
    };
  }

  visitColumn_list (ctx) {
    return ctx.column_name().map((c) => c.accept(this));
  }

  //  tableview_name
  //  : identifier ('.' id_expression)? (
  //      AT_SIGN link_name
  //      | /*TODO{!(input.LA(2) == BY)}?*/ partition_extension_clause
  //  )?
  //  | xmltable outer_join_sign?
  //  ;
  visitTableview_name (ctx) {
    const schema = ctx.id_expression() ? [ctx.identifier().accept(this)] : [];
    const table = ctx.id_expression() ? ctx.id_expression().accept(this) : ctx.identifier().accept(this);
    return [...schema, table];
  }

  visitSchema_name (ctx) {
    return ctx.identifier().accept(this);
  }

  visitTable_name (ctx) {
    return ctx.identifier().accept(this);
  }

  visitColumn_name (ctx) {
    return [ctx.identifier().accept(this)].concat(ctx.id_expression().map((i) => i.accept(this)));
  }

  visitIdentifier (ctx) {
    const text = getOriginalText(ctx);
    return unquoteString(text);
  }

  visitType_name (ctx) {
    const names = ctx.id_expression().map((i) => i.accept(this));
    const typeName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;
    return {
      type_name: typeName,
      schemaName,
    };
  }

  visitDatatype (ctx) {
    const typeName = getOriginalText(ctx);
    return {
      type_name: unquoteString(typeName),
    };
  }

  // comment_on_table
  //   : COMMENT ON TABLE tableview_name IS quoted_string
  //   ;
  visitComment_on_table (ctx) {
    const names = ctx.tableview_name().accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;
    const table = findTable(this.data.tables, schemaName, tableName);
    if (!table) {
      throw createCompilerError(ctx.tableview_name(), `Table "${tableName}" not found`);
    }
    const note = ctx.quoted_string().accept(this);
    table.note = { value: note };
  }

  // comment_on_column
  //   : COMMENT ON COLUMN column_name IS quoted_string
  //   ;
  visitComment_on_column (ctx) {
    const names = ctx.column_name().accept(this);
    const columnName = last(names);
    names.pop();
    const tableName = last(names);
    names.pop();
    const schemaName = last(names);

    const table = findTable(this.data.tables, schemaName, tableName);
    if (!table) {
      throw createCompilerError(ctx.column_name(), `Table "${tableName}" not found`);
    }
    const field = findColumn(table, columnName);
    if (!field) {
      throw createCompilerError(ctx.column_name(), `Column "${columnName}" not found in table "${tableName}"`);
    }
    const note = ctx.quoted_string().accept(this);
    field.note = { value: note };
  }

  // alter_table
  //   : ALTER TABLE tableview_name memoptimize_read_write_clause* (constraint_clauses | column_clauses | <other rules>) ((enable_disable_clause | enable_or_disable (TABLE LOCK | ALL TRIGGERS))+)?

  //   ;
  visitAlter_table (ctx) {
    const names = ctx.tableview_name().accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;
    const table = findTable(this.data.tables, schemaName, tableName);
    if (!table) {
      throw createCompilerError(ctx.tableview_name(), `Table "${tableName}" not found`);
    }

    function handleConstraint (column, constraint) {
      switch (constraint.type) {
        case TABLE_CONSTRAINT_KIND.FK:
        case COLUMN_CONSTRAINT_KIND.FK:
          constraint.value.endpoints[0].tableName = tableName;
          constraint.value.endpoints[0].schemaName = schemaName;
          this.data.refs.push(constraint.value);
          break;

        case TABLE_CONSTRAINT_KIND.CHECK:
          if (!table.checks) table.checks = [];
          table.checks.push(...constraint.value.checks);
          break;
        case COLUMN_CONSTRAINT_KIND.CHECK:
          if (!column.checks) table.checks = [];
          column.checks.push(...constraint.value.checks);
          break;

        case COLUMN_CONSTRAINT_KIND.PK:
          column.pk = true;
          column.unique = undefined;
          break;
        case COLUMN_CONSTRAINT_KIND.UNIQUE:
          column.unique = true;
          break;

        case TABLE_CONSTRAINT_KIND.UNIQUE:
        case TABLE_CONSTRAINT_KIND.INDEX:
        case TABLE_CONSTRAINT_KIND.PK:
          if (!table.indexes) table.indexes = [];
          table.indexes.push(constraint.value);
          break;

        case COLUMN_CONSTRAINT_KIND.DEFAULT:
          column.dbdefault = constraint.value.dbdefault;
          break;
        case COLUMN_CONSTRAINT_KIND.NOT_NULL:
          column.not_null = true;
          break;
        case COLUMN_CONSTRAINT_KIND.NULLABLE:
          column.not_null = false;
          break;
        case COLUMN_CONSTRAINT_KIND.INCREMENT:
          column.increment = true;
          break;

        default:
      }
    }

    if (ctx.constraint_clauses() || ctx.column_clauses()) {
      const res = ctx.constraint_clauses() ? [{ column: null, constraints: ctx.constraint_clauses().accept(this) }] : ctx.column_clauses().accept(this);
      res.forEach((r) => {
        const column = r.column !== null ? findColumn(table, r.column) : null;
        if (r.column !== null && !column) {
          throw createCompilerError(ctx.tableview_name(), `Column "${r.column}" not found on Table "${tableName}"`);
        }
        r.constraints.forEach((c) => handleConstraint.bind(this)(column, c));
      });
    }
  }

  // column_clauses
  //   : add_modify_drop_column_clauses
  //   | <other rules>
  //   ;
  visitColumn_clauses (ctx) {
    if (ctx.add_modify_drop_column_clauses()) {
      return ctx.add_modify_drop_column_clauses().accept(this);
    }
    return [];
  }

  // add_modify_drop_column_clauses
  // : (constraint_clauses | add_column_clause | modify_column_clauses | drop_column_clause)+
  // ;
  visitAdd_modify_drop_column_clauses (ctx) {
    const constraints = [];
    if (ctx.constraint_clauses()) {
      constraints.push({ column: null, constraints: ctx.constraint_clauses().flatMap((c) => c.accept(this)) });
    }
    if (ctx.modify_column_clauses()) {
      constraints.push(...ctx.modify_column_clauses().flatMap((c) => c.accept(this)));
    }
    return constraints;
  }

  // modify_column_clauses
  // : MODIFY (
  //      '(' modify_col_properties (',' modify_col_properties)* ')'
  //      | '(' modify_col_visibility (',' modify_col_visibility)* ')'
  //      | modify_col_properties
  //      | modify_col_visibility
  //      | modify_col_substitutable
  //  )
  //  ;
  visitModify_column_clauses (ctx) {
    return ctx.modify_col_properties().map((c) => c.accept(this));
  }

  // modify_col_properties
  // : column_name datatype? (DEFAULT (ON NULL_)? expression)? (ENCRYPT encryption_spec | DECRYPT)? inline_constraint* lob_storage_clause? annotations_clause?
  // ;
  visitModify_col_properties (ctx) {
    const constraints = [];
    const columnName = last(ctx.column_name().accept(this));
    if (ctx.DEFAULT()) {
      const expression = ctx.expression().accept(this);
      constraints.push({
        type: COLUMN_CONSTRAINT_KIND.DEFAULT,
        value: {
          dbdefault: processDefaultExpression(expression),
        },
      });
    } else if (ctx.inline_constraint()) {
      constraints.push(...ctx.inline_constraint().map((c) => c.accept(this)));
    }
    return {
      column: columnName,
      constraints,
    };
  }

  // constraint_clauses
  //   : ADD '(' (out_of_line_constraint (',' out_of_line_constraint)* | out_of_line_ref_constraint) ')'
  //   | ADD (out_of_line_constraint | out_of_line_ref_constraint)
  //   | <other rules>
  //   ;
  visitConstraint_clauses (ctx) {
    if (ctx.out_of_line_constraint()) {
      return ctx.out_of_line_constraint().map((c) => c.accept(this)).filter(Boolean);
    }
    if (ctx.out_of_line_ref_constraint()) {
      return [ctx.out_of_line_ref_constraint().accept(this)];
    }
    return [];
  }

  // create_index
  //  : CREATE (UNIQUE | BITMAP)? INDEX index_name (IF NOT EXISTS)? ON (
  //     cluster_index_clause
  //      | table_index_clause
  //      | bitmap_join_index_clause
  //  ) (USABLE | UNUSABLE)? ((DEFERRED | IMMEDIATE) INVALIDATION)?
  //  ;
  visitCreate_index (ctx) {
    if (!ctx.table_index_clause()) return;

    const unique = !!ctx.UNIQUE();
    const bitmap = !!ctx.BITMAP();

    const indexName = ctx.index_name().accept(this);

    const { names, columns } = ctx.table_index_clause().accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

    const table = findTable(this.data.tables, schemaName, tableName);
    if (!table) {
      throw createCompilerError(ctx.table_index_clause(), `Table ${tableName} not found`);
    }

    if (!table.indexes) table.indexes = [];
    table.indexes.push(
      new Index({
        name: indexName,
        columns,
        unique,
        type: bitmap ? 'bitmap' : undefined,
      }),
    );
  }

  // table_index_clause
  //  : tableview_name table_alias? '(' index_expr (ASC | DESC)? (',' index_expr (ASC | DESC)?)* ')' index_properties?
  //  ;
  visitTable_index_clause (ctx) {
    const names = ctx.tableview_name().accept(this);
    const columns = ctx.index_expr().map((i) => i.accept(this));
    return {
      names,
      columns,
    };
  }

  // constraint_name
  //   : id_expression
  //   ;
  visitConstraint_name (ctx) {
    return unquoteString(getOriginalText(ctx));
  }

  visitIndex_name (ctx) {
    return ctx.identifier().accept(this);
  }

  // index_expr
  //  : column_name
  //  | expression
  //  ;

  visitIndex_expr (ctx) {
    if (ctx.expression()) {
      const expression = processIndexExpression(ctx.expression().accept(this));
      return {
        value: expression.value,
        type: expression.type,
      };
    }
    const columnName = last(ctx.column_name().accept(this));
    return {
      value: columnName,
      type: CONSTRAINT_TYPE.COLUMN,
    };
  }

  // insert_statement
  //   : INSERT (single_table_insert | <other rules>)
  //   ;
  visitInsert_statement (ctx) {
    if (ctx.single_table_insert()) {
      ctx.single_table_insert().accept(this);
    }
  }

  // single_table_insert
  //   : insert_into_clause (values_clause | <other rules>)
  //   ;
  visitSingle_table_insert (ctx) {
    const intoClause = ctx.insert_into_clause().accept(this);
    const valuesClause = ctx.values_clause().accept(this);

    if (intoClause && valuesClause) {
      const { tableName, schemaName, columns } = intoClause;
      const { values } = valuesClause;

      const record = new TableRecord({
        schemaName,
        tableName,
        columns,
        values,
      });
      this.data.records.push(record);
    }
  }

  // insert_into_clause
  //   : INTO general_table_ref paren_column_list?
  //   ;
  visitInsert_into_clause (ctx) {
    const names = ctx.general_table_ref().accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;
    const columns = ctx.paren_column_list() ? ctx.paren_column_list().accept(this).map((c) => last(c)) : [];
    return {
      tableName,
      schemaName,
      columns,
    };
  }

  visitGeneral_table_ref (ctx) {
    return ctx.dml_table_expression_clause().accept(this);
  }

  visitDml_table_expression_clause (ctx) {
    if (ctx.tableview_name()) {
      return ctx.tableview_name().accept(this);
    }
    return [];
  }

  visitParen_column_list (ctx) {
    return ctx.column_list().accept(this);
  }

  // values_clause
  //   : VALUES '(' expressions_ ')'
  //   ;
  visitValues_clause (ctx) {
    const expressions = ctx.expressions_().accept(this);
    return {
      values: [expressions.map((e) => ({
        value: e.type !== CONSTRAINT_TYPE.COLUMN ? e.value : e.rawValue,
        type: e.type !== CONSTRAINT_TYPE.COLUMN ? e.type : DATA_TYPE.EXPRESSION,
      }))],
    };
  }

  visitExpressions_ (ctx) {
    return ctx.expression().map((e) => e.accept(this));
  }

  visitId_expression (ctx) {
    const text = getOriginalText(ctx);
    return unquoteString(text);
  }

  // expression
  //  : CHAR_STRING
  //  | TRUE
  //  | FALSE
  //  | NULL_
  //  | APPROXIMATE_NUM_LIT
  //  | UNSIGNED_INTEGER
  //  | column_name
  //  | cursor_expression
  //  | logical_expression
  //  ;
  visitExpression (ctx) {
    const value = getOriginalText(ctx);
    if (ctx.CHAR_STRING()) {
      return {
        type: DATA_TYPE.STRING,
        value: unquoteString(value, "'"), // string literals use single quotes
      };
    }
    if (ctx.TRUE()) {
      return {
        type: DATA_TYPE.BOOLEAN,
        value: true,
      };
    }
    if (ctx.FALSE()) {
      return {
        type: DATA_TYPE.BOOLEAN,
        value: false,
      };
    }
    if (ctx.NULL_()) {
      return {
        type: DATA_TYPE.BOOLEAN,
        value: null,
      };
    }
    if (ctx.APPROXIMATE_NUM_LIT() || ctx.UNSIGNED_INTEGER()) {
      return {
        type: DATA_TYPE.NUMBER,
        value: parseFloat(value),
      };
    }
    if (ctx.column_name()) {
      return {
        type: CONSTRAINT_TYPE.COLUMN,
        rawValue: unquoteString(value),
        value: unquoteString(getOriginalText(ctx.column_name())),
      };
    }
    return {
      type: CONSTRAINT_TYPE.EXPRESSION,
      value,
    };
  }

  visitQuoted_string (ctx) {
    return unquoteString(getOriginalText(ctx), "'"); // string literals use single quotes
  }

  visitRegular_id (ctx) {
    return unquoteString(getOriginalText(ctx), '"');
  }
}
