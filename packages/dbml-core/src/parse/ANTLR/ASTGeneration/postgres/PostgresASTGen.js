/* eslint-disable class-methods-use-this */
import { last, flatten } from 'lodash';
import PostgreSQLParserVisitor from '../../parsers/postgresql/PostgreSQLParserVisitor';
import { Enum, Field, Index, Table } from '../AST';
import { TABLE_CONSTRAINT_KIND, CONSTRAINT_TYPE, COLUMN_CONSTRAINT_KIND, DATA_TYPE } from '../constants';

const COMMAND_KIND = {
  REF: 'ref',
}

const COMMENT_OBJECT_TYPE = {
  TABLE: 'table',
}

const findTable = (tables, schemaName, tableName) => {
  const realSchemaName = schemaName || 'public';
  const table = tables.find(table => {
    const targetSchemaName = table.schemaName || 'public';
    return targetSchemaName === realSchemaName && table.name === tableName;
  });
  return table;
};

const escapeStr = (str) => {
  if (str) {
    return str.replaceAll("''", "'");
  }
  return str;
}

export default class PostgresASTGen extends PostgreSQLParserVisitor {

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

  // stmtblock EOF
  visitRoot (ctx) {
    ctx.stmtblock().accept(this);
    return this.data;
  }

  // stmtmulti
  visitStmtblock (ctx) {
    ctx.stmtmulti().accept(this);
  }

  // (stmt SEMI?)*
  visitStmtmulti (ctx) {
    ctx.stmt().map((stmt) => stmt.accept(this));
  }

  // check PostgresSQLParser.g4 line 31
  visitStmt (ctx) {
    if (ctx.createstmt()) {
      const table = ctx.createstmt().accept(this);

      return this.data.tables.push(table);
    }

    if (ctx.indexstmt()) {
      /** @type {Index} */
      const indexStmt = ctx.indexstmt().accept(this);
      const { tableName, schemaName } = indexStmt.pathName;

      const table = findTable(this.data.tables, schemaName, tableName);
      if (!table) return;
      return table.indexes.push(indexStmt.index);
    }

    if (ctx.altertablestmt()) {
      ctx.altertablestmt().accept(this);
      return;
    }

    if (ctx.commentstmt()) {
      ctx.commentstmt().accept(this);
      return;
    }
    
    if (ctx.definestmt()) {
      ctx.definestmt().accept(this);
      return;
    }
  }

  /*
   CREATE opttemp TABLE (IF_P NOT EXISTS)? qualified_name (
   OPEN_PAREN opttableelementlist CLOSE_PAREN optinherit optpartitionspec
   table_access_method_clause optwith oncommitoption opttablespace
   | OF any_name opttypedtableelementlist optpartitionspec table_access_method_clause
   optwith oncommitoption opttablespace | PARTITION OF qualified_name opttypedtableelementlist
   partitionboundspec optpartitionspec table_access_method_clause optwith oncommitoption opttablespace)
   */
  visitCreatestmt (ctx) {
    const names = ctx.qualified_name(0).accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

    if (!ctx.opttableelementlist()) return;

    const tableElements = ctx.opttableelementlist().accept(this).filter(e => e);

    const [fieldsData, indexes, tableRefs] = tableElements.reduce((acc, ele) => {
      if (ele.kind === TABLE_CONSTRAINT_KIND.FIELD) acc[0].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.INDEX) acc[1].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.FK) acc[2].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.UNIQUE) acc[1].push(ele.value);
      return acc;
    }, [[], [], []]);

    this.data.refs.push(...flatten(
      fieldsData.map(fieldData => fieldData.inline_refs.map(inlineRef => {
        inlineRef.endpoints[0].tableName = tableName;
        inlineRef.endpoints[0].schemaName = schemaName;
        inlineRef.endpoints[0].fieldNames = [fieldData.field.name];
        return inlineRef;
      }))
    ));

    this.data.refs.push(...tableRefs.map(tableRef => {
      tableRef.endpoints[0].tableName = tableName;
      tableRef.endpoints[0].schemaName = schemaName;
      return tableRef;
    }));

    return new Table({
      name: tableName,
      schemaName,
      fields: fieldsData.map(fd => fd.field),
      indexes,
    })
  }

  // tableelementlist
  visitOpttableelementlist (ctx) {
    if (!ctx.tableelementlist()) return [];
    return ctx.tableelementlist().accept(this);
  }

  // tableelement (COMMA tableelement)*
  visitTableelementlist (ctx) {
    return ctx.tableelement().map((element) => {
      return element.accept(this);
    })
  }

  // tableconstraint | tablelikeclause | columnDef
  visitTableelement (ctx) {
    if (ctx.columnDef()) return ctx.columnDef().accept(this);
    if (ctx.tableconstraint()) return ctx.tableconstraint().accept(this);
  }

  // CONSTRAINT name constraintelem | constraintelem
  visitTableconstraint (ctx) {
    const constraintName = ctx.name()?.accept(this);
    const constraint = ctx.constraintelem().accept(this);

    if (!constraint) return;

    constraint.value.name = constraintName;
    return constraint;
  }

  /*
   CHECK OPEN_PAREN a_expr CLOSE_PAREN constraintattributespec
   | UNIQUE (OPEN_PAREN columnlist CLOSE_PAREN opt_c_include opt_definition optconstablespace constraintattributespec | existingindex constraintattributespec)
   | PRIMARY KEY (OPEN_PAREN columnlist CLOSE_PAREN opt_c_include opt_definition optconstablespace constraintattributespec | existingindex constraintattributespec)
   | EXCLUDE access_method_clause OPEN_PAREN exclusionconstraintlist CLOSE_PAREN opt_c_include opt_definition optconstablespace exclusionwhereclause constraintattributespec
   | FOREIGN KEY OPEN_PAREN columnlist CLOSE_PAREN REFERENCES qualified_name opt_column_list key_match key_actions constraintattributespec
   */
  visitConstraintelem (ctx) {
    if (ctx.PRIMARY()) {
      return {
        kind: TABLE_CONSTRAINT_KIND.INDEX,
        value: new Index({
          pk: true,
          columns: ctx.columnlist().accept(this),
        }),
        // value: {
        //   type: 'PrimaryKey',
        //   columns: 
        // },
      }
    }

    if (ctx.FOREIGN()) {
      const names = ctx.qualified_name().accept(this);
      const refTableName = last(names);
      const refSchemaName = names.length > 1 ? names[names.length - 2] : undefined;

      const firstFieldNames = ctx.columnlist().accept(this).map(c => c.value);
      const secondFieldNames = ctx.opt_column_list().accept(this)?.map(c => c.value);

      const actions = ctx.key_actions().accept(this);

      return {
        kind: TABLE_CONSTRAINT_KIND.FK,
        value: {
          endpoints: [{
            tableName: null,
            schemaName: null,
            fieldNames: firstFieldNames,
            relation: '*',
          }, {
            tableName: refTableName,
            schemaName: refSchemaName,
            fieldNames: secondFieldNames,
            relation: '1',
          }],
          onDelete: actions.onDelete,
          onUpdate: actions.onUpdate,
        }
      }
    }

    if (ctx.UNIQUE()) {
      return {
        kind: TABLE_CONSTRAINT_KIND.UNIQUE,
        value: new Index({
          unique: true,
          columns: ctx.columnlist().accept(this),
        }),
      }
    }
  }

  // OPEN_PAREN columnlist CLOSE_PAREN |
  visitOpt_column_list (ctx) {
    return ctx.columnlist()?.accept(this);
  }

  // columnElem (COMMA columnElem)*
  visitColumnlist (ctx) {
    return ctx.columnElem().map((c) => c.accept(this));
  }

  // colid
  visitColumnElem (ctx) {
    return {
      value: ctx.colid().accept(this),
      type: CONSTRAINT_TYPE.COLUMN,
    };
  }

  // colid typename create_generic_options colquallist
  visitColumnDef (ctx) {
    const name = ctx.colid().accept(this);
    const type = ctx.typename().accept(this);

    const contraints = ctx.colquallist().accept(this);

    const serialIncrementType = new Set(['serial', 'smallserial', 'bigserial']);
    const columnTypeName = type.type_name.toLowerCase();
    if ((serialIncrementType.has(columnTypeName))) contraints.increment = true;

    return {
      kind: TABLE_CONSTRAINT_KIND.FIELD,
      value: {
        field: new Field({
          name,
          type,
          ...contraints,
        }),
        inline_refs: contraints.inline_refs,
      },
    };
  }

  // colconstraint*
  visitColquallist (ctx) {
    const r = { inline_refs: [] };
    ctx.colconstraint().forEach(c => {
      const constraint = c.accept(this);
      if (!constraint) return;

      if (constraint.kind === COLUMN_CONSTRAINT_KIND.INLINE_REF) {
        r.inline_refs.push(constraint.value);
        return;
      }

      r[constraint.kind] = constraint.value;
    });

    return r;
  }

  /*
   CONSTRAINT name colconstraintelem
   | colconstraintelem
   | constraintattr
   | COLLATE any_name
   */
  visitColconstraint (ctx) {
    if (ctx.colconstraintelem()) {
      return ctx.colconstraintelem().accept(this);
    }
  }

  /*
   NOT NULL_P
   | NULL_P
   | UNIQUE opt_definition optconstablespace
   | PRIMARY KEY opt_definition optconstablespace
   | CHECK OPEN_PAREN a_expr CLOSE_PAREN opt_no_inherit
   | DEFAULT b_expr
   | GENERATED generated_when AS (IDENTITY_P optparenthesizedseqoptlist | OPEN_PAREN a_expr CLOSE_PAREN STORED)
   | REFERENCES qualified_name opt_column_list key_match key_actions
   */
  visitColconstraintelem (ctx) {
    if (ctx.NULL_P()) {
      let notNull = false;
      if (ctx.NOT()) notNull = true;
      return { kind: COLUMN_CONSTRAINT_KIND.NOT_NULL, value: notNull };
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

    if (ctx.DEFAULT()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.DEFAULT,
        value: ctx.b_expr().accept(this),
      };
    }

    if (ctx.IDENTITY_P()) {
      return {
        kind: COLUMN_CONSTRAINT_KIND.INCREMENT,
        value: true,
      };
    }

    if (ctx.REFERENCES()) {
      const names = ctx.qualified_name().accept(this);
      const refTableName = last(names);
      const refSchemaName = names.length > 1 ? names[names.length - 2] : undefined;
      const secondFieldNames = ctx.opt_column_list().accept(this)?.map(c => c.value);

      const actions = ctx.key_actions().accept(this);
      return {
        kind: COLUMN_CONSTRAINT_KIND.INLINE_REF,
        value: {
          endpoints: [{
            tableName: null,
            schemaName: null,
            fieldNames: null,
            relation: '*',
          }, {
            tableName: refTableName,
            schemaName: refSchemaName,
            fieldNames: secondFieldNames,
            relation: '1',
          }],
          onDelete: actions.onDelete,
          onUpdate: actions.onUpdate,
        },
      };
    }
  }

  // check PostgresSQLParser.g4 line 3619
  visitB_expr (ctx) {
    if (ctx.c_expr()) return ctx.c_expr().accept(this);
    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    }
  }

  // check PostgresSQLParser.g4 line 3640
  visitC_expr_expr (ctx) {
    if (ctx.aexprconst()) return ctx.aexprconst().accept(this);
    if (ctx.a_expr()) return {
      value: ctx.a_expr().getText(),
      type: DATA_TYPE.EXPRESSION
    }
    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    }
  }

  visitC_expr_exists (ctx) {
    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    }
  }

  visitC_expr_case (ctx) {
    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    }
  }

  // iconst | fconst | sconst | bconst | xconst | func_name (sconst | OPEN_PAREN func_arg_list opt_sort_clause CLOSE_PAREN sconst) | consttypename sconst | constinterval (sconst opt_interval | OPEN_PAREN iconst CLOSE_PAREN sconst) | TRUE_P | FALSE_P | NULL_P
  visitAexprconst (ctx) {
    if (ctx.sconst() && ctx.getChildCount() === 1) {
      return {
        value: ctx.sconst().accept(this),
        type: DATA_TYPE.STRING,
      };
    }

    if (ctx.TRUE_P() || ctx.FALSE_P() || ctx.NULL_P()) {
      return {
        value: ctx.getText(),
        type: DATA_TYPE.BOOLEAN,
      };
    }

    if (ctx.iconst() || ctx.fconst) {
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

  // key_update | key_delete | key_update key_delete | key_delete key_update |
  visitKey_actions (ctx) {
    let [onDelete, onUpdate] = [null, null];
    if (ctx.key_update()) onUpdate = ctx.key_update().accept(this);
    if (ctx.key_delete()) onDelete = ctx.key_delete().accept(this);
    return {
      onDelete,
      onUpdate,
    };
  }

  // ON UPDATE key_action
  visitKey_update (ctx) {
    return ctx.key_action().accept(this);
  }

  // ON DELETE_P key_action
  visitKey_delete (ctx) {
    return ctx.key_action().accept(this);
  }

  // NO ACTION | RESTRICT | CASCADE | SET (NULL_P | DEFAULT)
  visitKey_action (ctx) {
    // Generate n element integer array [0, 1, ..., n-1]
    const childIndices = [...Array(ctx.getChildCount()).keys()];
    const text = childIndices.reduce((acc, i) => {
      acc += `${ctx.getChild(i).getText()} `;
      return acc;
    }, '');

    return text.slice(0, text.length - 1); // remove the last whitespace
  }

  // colid indirection?
  visitQualified_name (ctx) {
    const r = [ctx.colid().accept(this)];
    if (ctx.indirection()) {
      r.push(...ctx.indirection().accept(this));
    }

    return r;
  }

  /*
   identifier
   | unreserved_keyword
   | col_name_keyword
   | plsql_unreserved_keyword
   | LEFT
   | RIGHT
   */
  visitColid (ctx) {
    return ctx.getChild(0).accept(this);
  }

  // check PostgresSQLParser.g4 line 4187
  visitUnreserved_keyword (ctx) {
    return ctx.getText();
  }
  
  /*
   Identifier opt_uescape
   | QuotedIdentifier
   | UnicodeQuotedIdentifier
   | plsqlvariablename
   | plsqlidentifier
   | plsql_unreserved_keyword
   */
  visitIdentifier (ctx) {
    if (ctx.Identifier()) {
      return ctx.Identifier().getText();
    }

    if (ctx.QuotedIdentifier()) {
      const qId = ctx.QuotedIdentifier().getText();
      return qId.slice(1, qId.length - 1);
    }

    if (ctx.UnicodeQuotedIdentifier()) {
      const qId = ctx.UnicodeQuotedIdentifier().getText();
      return qId.slice(1, qId.length - 1);
    }

    if (ctx.plsql_unreserved_keyword()) {
      return ctx.plsql_unreserved_keyword().accept(this);
    }

    return ctx.getChild(0).getText();
  }

  visitUnreserved_keyword (ctx) {
    return ctx.getChild(0).getText();
  }

  visitCol_name_keyword (ctx) {
    return ctx.getChild(0).getText();
  }

  visitPlsql_unreserved_keyword (ctx) {
    return ctx.getChild(0).getText();
  }

  // indirection_el+
  visitIndirection (ctx) {
    return ctx.indirection_el().map(i => i.accept(this));
  }

  // DOT (attr_name | STAR) 
  // | OPEN_BRACKET (a_expr | opt_slice_bound COLON opt_slice_bound) CLOSE_BRACKET
  visitIndirection_el (ctx) {
    if (ctx.attr_name()) return ctx.attr_name().accept(this);
  }

  // collabel
  visitAttr_name (ctx) {
    return ctx.collabel().accept(this);
  }

  /*
   identifier
   | plsql_unreserved_keyword
   | unreserved_keyword
   | col_name_keyword
   | type_func_name_keyword
   | reserved_keyword
   */
  visitCollabel (ctx) {
    return ctx.getChild(0).accept(this);
  }

  // check PostgresSQLParser.g4 line 4567
  visitReserved_keyword (ctx) {
    return ctx.getText();
  }

  // SETOF? simpletypename (opt_array_bounds | ARRAY (OPEN_BRACKET iconst CLOSE_BRACKET)?)
  // | qualified_name PERCENT (ROWTYPE | TYPE_P)
  visitTypename (ctx) {
    if (ctx.simpletypename()) {
      let arrayExtension = '';
      const type = ctx.simpletypename().accept(this);

      if (ctx.opt_array_bounds()) arrayExtension = ctx.opt_array_bounds().accept(this);

      if (ctx.ARRAY()) arrayExtension = `[${ctx.iconst() ? ctx.iconst().accept(this) : ''}]`;
      return {
        type_name: type.type + arrayExtension,
        schemaName: type.schemaName,
      }
    }
  }

  /*
   generictype
   | numeric
   | bit
   | character
   | constdatetime
   | constinterval (opt_interval | OPEN_PAREN iconst CLOSE_PAREN)
   */
  visitSimpletypename (ctx) {
    if (ctx.generictype()) return ctx.generictype().accept(this);

    if (ctx.character()) return {
      type: ctx.character().accept(this),
      schemaName: null,
    }

    if (ctx.numeric()) return {
      type: ctx.numeric().accept(this),
      schemaName: null,
    }

    if (ctx.constdatetime()) return {
      type: ctx.constdatetime().accept(this),
      schemaName: null,
    }

    return {
      type: ctx.getText(),
      schemaName: null,
    }
  }

  // (TIMESTAMP | TIME) (OPEN_PAREN iconst CLOSE_PAREN)? opt_timezone
  visitConstdatetime (ctx) {
    return `${ctx.getChild(0).getText()}${ctx.iconst() ? `(${ctx.iconst().accept(this)})` : ''}`;
  }

  // INT_P | INTEGER | SMALLINT | BIGINT | REAL | FLOAT_P opt_float | DOUBLE_P PRECISION | DECIMAL_P opt_type_modifiers | DEC opt_type_modifiers | NUMERIC opt_type_modifiers | BOOLEAN_P
  visitNumeric (ctx) {
    return ctx.getText();
  }

  // (builtin_function_name | type_function_name | LEFT | RIGHT) attrs? opt_type_modifiers
  visitGenerictype (ctx) {
    if (ctx.attrs()) {
      const names = [ctx.getChild(0).getText(), ...ctx.attrs().accept(this)];
      const enumName = last(names);
      const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

      return {
        type: enumName,
        schemaName,
      }
    }
    let type = '';
    if (ctx.type_function_name()) type = ctx.type_function_name().accept(this);
    else type = ctx.getText();

    return {
      type: type + ctx.opt_type_modifiers().getText(),
      schemaName: null,
    };
  }

  // character_c (OPEN_PAREN iconst CLOSE_PAREN)?
  visitCharacter (ctx) {
    let r = ctx.character_c().accept(this);
    if (ctx.getChildCount() > 1) {
      r += `(${ctx.iconst().accept(this)})`;
    }
    return r;
  }

  // (CHARACTER | CHAR_P | NCHAR) opt_varying
  // | VARCHAR
  // | NATIONAL (CHARACTER | CHAR_P) opt_varying
  visitCharacter_c (ctx) {
    // Generate n element integer array [0, 1, ..., n-1]
    const childIndices = [...Array(ctx.getChildCount()).keys()];
    const text = childIndices.reduce((acc, i) => {
      acc += `${ctx.getChild(i).getText()} `;
      return acc;
    }, '');

    return text.slice(0, text.length - 1); // remove the last whitespace
  }

  // identifier | unreserved_keyword | plsql_unreserved_keyword | type_func_name_keyword
  visitType_function_name (ctx) {
    return ctx.getChild(0).accept(this);
  }

  visitType_func_name_keyword (ctx) {
    return ctx.getText();
  }

  // (OPEN_BRACKET iconst? CLOSE_BRACKET)*
  visitOpt_array_bounds (ctx) {
    return ctx.getText();
  }

  // Integral
  visitIconst (ctx) {
    return ctx.Integral().getText();
  }

  // CREATE opt_unique INDEX opt_concurrently opt_index_name ON relation_expr access_method_clause OPEN_PAREN index_params CLOSE_PAREN opt_include opt_reloptions opttablespace where_clause
  // | CREATE opt_unique INDEX opt_concurrently IF_P NOT EXISTS name ON relation_expr access_method_clause OPEN_PAREN index_params CLOSE_PAREN opt_include opt_reloptions opttablespace where_clause
  visitIndexstmt (ctx) {
    const names = ctx.relation_expr().accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

    if (ctx.opt_index_name()) {
      const r = {
        pathName: {
          tableName,
          schemaName,
        },
        index: new Index({
          name: ctx.opt_index_name().accept(this),
          unique: ctx.opt_unique().accept(this),
          type: ctx.access_method_clause().accept(this),
          columns: ctx.index_params().accept(this),
        })
      };
      return r;
    }
  }

  // name | 
  visitOpt_index_name (ctx) {
    return ctx.name()?.accept(this);
  }

  // colid
  visitName (ctx) {
    return ctx.colid().accept(this);
  }

  // USING name | 
  visitAccess_method_clause (ctx) {
    if (ctx.name()) return ctx.name().accept(this);
  }
  
  // qualified_name STAR?
  // | ONLY (qualified_name | OPEN_PAREN qualified_name CLOSE_PAREN)
  visitRelation_expr (ctx) {
    return ctx.qualified_name().accept(this);
  }

  // index_elem (COMMA index_elem)*
  visitIndex_params (ctx) {
    return ctx.index_elem().map(i => i.accept(this)).filter(col => !!col);
  }

  /*
   colid index_elem_options
   | func_expr_windowless index_elem_options
   | OPEN_PAREN a_expr CLOSE_PAREN index_elem_options
   */
  visitIndex_elem (ctx) {
    if (ctx.colid()) {
      return {
        value: ctx.colid().accept(this),
        type: CONSTRAINT_TYPE.STRING,
      }
    }
    return {
      value: ctx.getText(),
      type: CONSTRAINT_TYPE.EXPRESSION,
    }
  }

  // UNIQUE |
  visitOpt_unique (ctx) {
    return !!ctx.UNIQUE();
  }

  /*
   ALTER TABLE (IF_P EXISTS)? relation_expr (alter_table_cmds | partition_cmd)
   | ALTER TABLE ALL IN_P TABLESPACE name (OWNED BY role_list)? SET TABLESPACE name opt_nowait
   | ALTER INDEX (IF_P EXISTS)? qualified_name (alter_table_cmds | index_partition_cmd)
   | ALTER INDEX ALL IN_P TABLESPACE name (OWNED BY role_list)? SET TABLESPACE name opt_nowait
   | ALTER SEQUENCE (IF_P EXISTS)? qualified_name alter_table_cmds
   | ALTER VIEW (IF_P EXISTS)? qualified_name alter_table_cmds
   | ALTER MATERIALIZED VIEW (IF_P EXISTS)? qualified_name alter_table_cmds
   | ALTER MATERIALIZED VIEW ALL IN_P TABLESPACE name (OWNED BY role_list)? SET TABLESPACE name opt_nowait
   | ALTER FOREIGN TABLE (IF_P EXISTS)? relation_expr alter_table_cmds
   */
  visitAltertablestmt (ctx) {
    if (ctx.TABLE() && ctx.relation_expr() && ctx.alter_table_cmds()) {
      const names = ctx.relation_expr().accept(this);
      const tableName = last(names);
      const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

      const cmds = ctx.alter_table_cmds().accept(this);

      return cmds.map((cmd) => {
        if (!cmd) return;
        let kind = null;
        switch (cmd.kind) {
          case TABLE_CONSTRAINT_KIND.FK:
            kind = COMMAND_KIND.REF;
            cmd.value.endpoints[0].tableName = tableName;
            cmd.value.endpoints[0].schemaName = schemaName;
            this.data.refs.push(cmd.value);
            break;
          case TABLE_CONSTRAINT_KIND.UNIQUE:
          case TABLE_CONSTRAINT_KIND.INDEX:
            kind = cmd.kind;
            if (cmd.value.pk || cmd.value.unique) {
              let set_prop = cmd.value.unique ? (obj) => obj["unique"] = true : (obj) => obj["pk"] = true;
              const table = findTable(this.data.tables, schemaName, tableName);
              if (cmd.value.columns.length == 1) {
                // We are in the single column case, we can update the column as well
                let key = cmd.value.columns[0].value;
                let field_to_update = table.fields.find(f => f.name === key);
                // field might have been deleted
                if (field_to_update != null) {
                  set_prop(field_to_update);
                }
              }
              let index = table.indexes.find(idx => { idx.name == cmd.value.name });
              if (!index) {
                index = new Index({
                  name: cmd.value.name,
                  columns: cmd.value.columns,
                });
                table.indexes.push(index);
              }
              set_prop(index);
              index.columns = cmd.value.columns;
            }
            break;
          default:
            break;
        }
        return {
          kind,
          value: cmd.value,
        };
      }).filter(c => c);
    }
  }

  // alter_table_cmd (COMMA alter_table_cmd)*
  visitAlter_table_cmds (ctx) {
    return ctx.alter_table_cmd().map(a => a.accept(this));
  }

  // check PostgresSQLParser.g4 line 410
  visitAlter_table_cmd (ctx) {
    if (ctx.tableconstraint()) {
      const constraint = ctx.tableconstraint().accept(this);
      return constraint;
    }
  }

  /*
   COMMENT ON object_type_any_name any_name IS comment_text
   | COMMENT ON COLUMN any_name IS comment_text
   | COMMENT ON object_type_name name IS comment_text
   | COMMENT ON TYPE_P typename IS comment_text
   | COMMENT ON DOMAIN_P typename IS comment_text
   | COMMENT ON AGGREGATE aggregate_with_argtypes IS comment_text
   | COMMENT ON FUNCTION function_with_argtypes IS comment_text
   | COMMENT ON OPERATOR operator_with_argtypes IS comment_text
   | COMMENT ON CONSTRAINT name ON any_name IS comment_text
   | COMMENT ON CONSTRAINT name ON DOMAIN_P any_name IS comment_text
   | COMMENT ON object_type_name_on_any_name name ON any_name IS comment_text
   | COMMENT ON PROCEDURE function_with_argtypes IS comment_text
   | COMMENT ON ROUTINE function_with_argtypes IS comment_text
   | COMMENT ON TRANSFORM FOR typename LANGUAGE name IS comment_text
   | COMMENT ON OPERATOR CLASS any_name USING name IS comment_text
   | COMMENT ON OPERATOR FAMILY any_name USING name IS comment_text
   | COMMENT ON LARGE_P OBJECT_P numericonly IS comment_text
   | COMMENT ON CAST OPEN_PAREN typename AS typename CLOSE_PAREN IS comment_text
   */
  visitCommentstmt (ctx) {
    const note = ctx.comment_text().accept(this);

    if (ctx.object_type_any_name()) {
      const objectType = ctx.object_type_any_name().accept(this);
      if (!objectType) return;
      if (objectType === COMMENT_OBJECT_TYPE.TABLE) {
        const names = ctx.any_name().accept(this);
        const tableName = last(names);
        const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

        const table = findTable(this.data.tables, schemaName, tableName);
        if (!table) return;

        const note = ctx.comment_text().accept(this);
        table.note = { value: escapeStr(note) };
      }
    }

    if (ctx.COLUMN()) {
      const names = ctx.any_name().accept(this);
      const fieldName = last(names);
      const tableName = names.length > 1 ? names[names.length - 2] : undefined;
      const schemaName = names.length > 2 ? names[names.length - 3] : undefined;

      const table = findTable(this.data.tables, schemaName, tableName);
      const field = table.fields.find((field) => field.name === fieldName);

      if (!field) return;

      const note = ctx.comment_text().accept(this);
      field.note = { value: escapeStr(note) };
    }
  }

  // sconst | NULL_P
  visitComment_text (ctx) {
    if (ctx.NULL_P()) return null;
    return ctx.sconst().accept(this);
  }

  // anysconst opt_uescape
  visitSconst (ctx) {
    return ctx.anysconst().accept(this);
  }

  // StringConstant | UnicodeEscapeStringConstant | BeginDollarStringConstant DollarText* EndDollarStringConstant | EscapeStringConstant
  visitAnysconst (ctx) {
    const value = ctx.getChild(0).getText();
    return value.slice(1, value.length - 1);
  }

  // TABLE | SEQUENCE | VIEW | MATERIALIZED VIEW | INDEX | FOREIGN TABLE | COLLATION | CONVERSION_P | STATISTICS | TEXT_P SEARCH PARSER | TEXT_P SEARCH DICTIONARY | TEXT_P SEARCH TEMPLATE | TEXT_P SEARCH CONFIGURATION
  visitObject_type_any_name (ctx) {
    if (ctx.TABLE()) return COMMENT_OBJECT_TYPE.TABLE;
  }

  // colid attrs?
  visitAny_name (ctx) {
    const r = [ctx.colid().accept(this)];
    if (ctx.attrs()) {
      r.push(...ctx.attrs().accept(this));
    }
    return r;
  }

  // (DOT attr_name)+
  visitAttrs (ctx) {
    return ctx.attr_name().map(a => a.accept(this));
  }

  /*
   CREATE opt_or_replace AGGREGATE func_name aggr_args definition
   | CREATE opt_or_replace AGGREGATE func_name old_aggr_definition
   | CREATE OPERATOR any_operator definition
   | CREATE TYPE_P any_name definition
   | CREATE TYPE_P any_name
   | CREATE TYPE_P any_name AS OPEN_PAREN opttablefuncelementlist CLOSE_PAREN
   | CREATE TYPE_P any_name AS ENUM_P OPEN_PAREN opt_enum_val_list CLOSE_PAREN
   | CREATE TYPE_P any_name AS RANGE definition
   | CREATE TEXT_P SEARCH PARSER any_name definition
   | CREATE TEXT_P SEARCH DICTIONARY any_name definition
   | CREATE TEXT_P SEARCH TEMPLATE any_name definition
   | CREATE TEXT_P SEARCH CONFIGURATION any_name definition
   | CREATE COLLATION any_name definition
   | CREATE COLLATION IF_P NOT EXISTS any_name definition
   | CREATE COLLATION any_name FROM any_name
   | CREATE COLLATION IF_P NOT EXISTS any_name FROM any_name
   */
  visitDefinestmt (ctx) {
    if (ctx.TYPE_P() && ctx.opt_enum_val_list()) {
      const names = ctx.any_name(0).accept(this);
      const enumName = last(names);
      const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

      const values = ctx.opt_enum_val_list().accept(this).map(e => ({ name: e }));
      if (!values) return;

      // enum is a keyworkd
      const _enum = new Enum({
        name: enumName,
        schemaName,
        values,
      });

      this.data.enums.push(_enum.toJSON());
    }
  }

  // enum_val_list |
  visitOpt_enum_val_list (ctx) {
    return ctx.enum_val_list()?.accept(this);
  }

  // sconst (COMMA sconst)*
  visitEnum_val_list (ctx) {
    return ctx.sconst().map((s) => s.accept(this));
  }
}
