import { last, flatten, flattenDepth } from 'lodash';
import PostgreSQLParserVisitor from '../../parsers/postgresql/PostgreSQLParserVisitor';
import {
  Enum, Field, Index, TableRecord, Table,
} from '../AST';
import {
  TABLE_CONSTRAINT_KIND, CONSTRAINT_TYPE, COLUMN_CONSTRAINT_KIND, DATA_TYPE,
} from '../constants';
import { getOriginalText } from '../helpers';

const COMMAND_KIND = {
  REF: 'ref',
};

const COMMENT_OBJECT_TYPE = {
  TABLE: 'table',
};

const findTable = (tables, schemaName, tableName) => {
  const realSchemaName = schemaName || 'public';
  const table = tables.find((table) => {
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
};

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
      records: [],
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

  // stmt? (SEMI stmt?)*
  visitStmtmulti (ctx) {
    ctx.stmt().map((stmt) => stmt.accept(this));
  }

  // check PostgreSQLParser.g4 line 50
  visitStmt (ctx) {
    if (ctx.createstmt()) {
      const table = ctx.createstmt().accept(this);

      // filter out null table that can cause error in model_structure stage
      if (table) this.data.tables.push(table);
      return;
    }

    if (ctx.indexstmt()) {
      /** @type {Index} */
      const indexStmt = ctx.indexstmt().accept(this);
      const { tableName, schemaName } = indexStmt.pathName;

      const table = findTable(this.data.tables, schemaName, tableName);
      if (table) table.indexes.push(indexStmt.index);
      return;
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

    if (ctx.insertstmt()) {
      ctx.insertstmt().accept(this);
    }
  }

  /*
   CREATE opttemp? TABLE (IF_P NOT EXISTS)? qualified_name (
   OPEN_PAREN opttableelementlist? CLOSE_PAREN optinherit? optpartitionspec?
   table_access_method_clause? optwith? oncommitoption? opttablespace?
   | OF any_name opttypedtableelementlist? optpartitionspec? table_access_method_clause?
   optwith? oncommitoption? opttablespace? | PARTITION OF qualified_name opttypedtableelementlist?
   partitionboundspec optpartitionspec? table_access_method_clause? optwith? oncommitoption? opttablespace?)
   */
  visitCreatestmt (ctx) {
    const names = ctx.qualified_name(0).accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

    if (!ctx.opttableelementlist()) return;

    const tableElements = ctx.opttableelementlist().accept(this).filter((e) => e);

    const [fieldsData, indexes, tableRefs, tableChecks] = tableElements.reduce((acc, ele) => {
      if (ele.kind === TABLE_CONSTRAINT_KIND.FIELD) acc[0].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.INDEX) acc[1].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.FK) acc[2].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.UNIQUE) acc[1].push(ele.value);
      else if (ele.kind === TABLE_CONSTRAINT_KIND.CHECK) acc[3].push(ele.value);
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

    return new Table({
      name: tableName,
      schemaName,
      fields: fieldsData.map((fd) => fd.field),
      indexes,
      checks: tableChecks,
    });
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
    });
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
   | UNIQUE (OPEN_PAREN columnlist CLOSE_PAREN c_include_? definition_? optconstablespace? constraintattributespec | existingindex constraintattributespec)
   | PRIMARY KEY (OPEN_PAREN columnlist CLOSE_PAREN c_include_? definition_? optconstablespace? constraintattributespec | existingindex constraintattributespec)
   | EXCLUDE access_method_clause? OPEN_PAREN exclusionconstraintlist CLOSE_PAREN c_include_? definition_? optconstablespace? exclusionwhereclause? constraintattributespec
   | FOREIGN KEY OPEN_PAREN columnlist CLOSE_PAREN REFERENCES qualified_name column_list_? key_match? key_actions? constraintattributespec
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
      };
    }

    if (ctx.FOREIGN()) {
      const names = ctx.qualified_name().accept(this);
      const refTableName = last(names);
      const refSchemaName = names.length > 1 ? names[names.length - 2] : undefined;

      const firstFieldNames = ctx.columnlist().accept(this).map((c) => c.value);
      const secondFieldNames = ctx.column_list_()?.accept(this)?.map((c) => c.value);

      const keyActions = ctx.key_actions();
      const actions = keyActions ? keyActions.accept(this) : { onDelete: null, onUpdate: null };

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
        },
      };
    }

    if (ctx.UNIQUE()) {
      return {
        kind: TABLE_CONSTRAINT_KIND.UNIQUE,
        value: new Index({
          unique: true,
          columns: ctx.columnlist().accept(this),
        }),
      };
    }

    if (ctx.CHECK()) {
      const expression = getOriginalText(ctx.a_expr());
      return {
        kind: TABLE_CONSTRAINT_KIND.CHECK,
        value: {
          expression,
        },
      };
    }
  }

  // OPEN_PAREN columnlist CLOSE_PAREN
  visitColumn_list_ (ctx) {
    return ctx.columnlist().accept(this);
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

  // colid typename create_generic_options? colquallist
  visitColumnDef (ctx) {
    const name = ctx.colid().accept(this);
    const type = ctx.typename().accept(this);

    const constraints = ctx.colquallist().accept(this);

    const serialIncrementType = new Set(['serial', 'smallserial', 'bigserial']);
    const columnTypeName = type.type_name.toLowerCase();
    if ((serialIncrementType.has(columnTypeName))) constraints.increment = true;

    return {
      kind: TABLE_CONSTRAINT_KIND.FIELD,
      value: {
        field: new Field({
          name,
          type,
          ...constraints,
        }),
        inline_refs: constraints.inline_refs,
      },
    };
  }

  // colconstraint*
  visitColquallist (ctx) {
    const r = { inline_refs: [], checks: [] };
    ctx.colconstraint().forEach((c) => {
      const constraint = c.accept(this);
      if (!constraint) return;

      if (constraint.kind === COLUMN_CONSTRAINT_KIND.INLINE_REF) {
        r.inline_refs.push(constraint.value);
        return;
      }

      if (constraint.kind === COLUMN_CONSTRAINT_KIND.CHECK) {
        r.checks.push(constraint.value);
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
   | UNIQUE definition_? optconstablespace?
   | PRIMARY KEY definition_? optconstablespace?
   | CHECK OPEN_PAREN a_expr CLOSE_PAREN no_inherit_?
   | DEFAULT b_expr
   | GENERATED generated_when AS (IDENTITY_P optparenthesizedseqoptlist? | OPEN_PAREN a_expr CLOSE_PAREN STORED)
   | REFERENCES qualified_name column_list_? key_match? key_actions?
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

    if (ctx.CHECK()) {
      const expression = getOriginalText(ctx.a_expr());
      return {
        kind: COLUMN_CONSTRAINT_KIND.CHECK,
        value: {
          expression,
        },
      };
    }

    if (ctx.REFERENCES()) {
      const names = ctx.qualified_name().accept(this);
      const refTableName = last(names);
      const refSchemaName = names.length > 1 ? names[names.length - 2] : undefined;
      const secondFieldNames = ctx.column_list_()?.accept(this)?.map((c) => c.value);

      const keyActions = ctx.key_actions();
      const actions = keyActions ? keyActions.accept(this) : { onDelete: null, onUpdate: null };
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

  // check PostgreSQLParser.g4 line 3693
  visitB_expr (ctx) {
    if (ctx.c_expr()) return ctx.c_expr().accept(this);
    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  // check PostgreSQLParser.g4 line 3714
  visitC_expr_expr (ctx) {
    if (ctx.aexprconst()) return ctx.aexprconst().accept(this);
    if (ctx.a_expr()) {
      return {
        value: ctx.a_expr().getText(),
        type: DATA_TYPE.EXPRESSION,
      };
    }
    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  visitC_expr_exists (ctx) {
    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  visitC_expr_case (ctx) {
    return {
      value: ctx.getText(),
      type: DATA_TYPE.EXPRESSION,
    };
  }

  // iconst | fconst | sconst | bconst | xconst | func_name (sconst | OPEN_PAREN func_arg_list sort_clause_? CLOSE_PAREN sconst) | consttypename sconst | constinterval (sconst interval_? | OPEN_PAREN iconst CLOSE_PAREN sconst) | TRUE_P | FALSE_P | NULL_P
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

    if (ctx.iconst()) {
      return {
        value: ctx.iconst().accept(this),
        type: DATA_TYPE.NUMBER,
      };
    }

    if (ctx.fconst()) {
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

  // key_update | key_delete | key_update key_delete | key_delete key_update
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
   */
  visitColid (ctx) {
    return ctx.getChild(0).accept(this);
  }

  // check PostgreSQLParser.g4 line 4468
  visitUnreserved_keyword (ctx) {
    return ctx.getText();
  }

  /*
   Identifier uescape_?
   | QuotedIdentifier
   | UnicodeQuotedIdentifier
   | PLSQLVARIABLENAME
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

    return ctx.getChild(0).getText();
  }

  visitCol_name_keyword (ctx) {
    return ctx.getChild(0).getText();
  }

  // indirection_el+
  visitIndirection (ctx) {
    return ctx.indirection_el().map((i) => i.accept(this));
  }

  // DOT (attr_name | STAR)
  // | OPEN_BRACKET (a_expr | slice_bound_? COLON slice_bound_?) CLOSE_BRACKET
  visitIndirection_el (ctx) {
    if (ctx.attr_name()) return ctx.attr_name().accept(this);
  }

  // colLabel
  visitAttr_name (ctx) {
    return ctx.colLabel().accept(this);
  }

  /*
   identifier
   | unreserved_keyword
   | col_name_keyword
   | type_func_name_keyword
   | reserved_keyword
   | EXIT
   */
  visitColLabel (ctx) {
    if (ctx.EXIT()) return ctx.EXIT().getText();
    return ctx.getChild(0).accept(this);
  }

  // check PostgreSQLParser.g4 line 4917
  visitReserved_keyword (ctx) {
    return ctx.getText();
  }

  // SETOF? simpletypename (opt_array_bounds | ARRAY (OPEN_BRACKET iconst CLOSE_BRACKET)?)
  visitTypename (ctx) {
    if (ctx.simpletypename()) {
      let arrayExtension = '';
      const type = ctx.simpletypename().accept(this);

      if (ctx.opt_array_bounds()) arrayExtension = ctx.opt_array_bounds().accept(this);

      if (ctx.ARRAY()) arrayExtension = `[${ctx.iconst() ? ctx.iconst().accept(this) : ''}]`;
      return {
        type_name: type.type + arrayExtension,
        schemaName: type.schemaName,
      };
    }
  }

  /*
   generictype
   | numeric
   | bit
   | character
   | constdatetime
   | constinterval (interval_? | OPEN_PAREN iconst CLOSE_PAREN)
   | jsonType
   */
  visitSimpletypename (ctx) {
    if (ctx.generictype()) return ctx.generictype().accept(this);

    if (ctx.character()) {
      return {
        type: ctx.character().accept(this),
        schemaName: null,
      };
    }

    if (ctx.numeric()) {
      return {
        type: ctx.numeric().accept(this),
        schemaName: null,
      };
    }

    if (ctx.constdatetime()) {
      return {
        type: ctx.constdatetime().accept(this),
        schemaName: null,
      };
    }

    return {
      type: ctx.getText(),
      schemaName: null,
    };
  }

  // (TIMESTAMP | TIME) (OPEN_PAREN iconst CLOSE_PAREN)? timezone_?
  visitConstdatetime (ctx) {
    return `${ctx.getChild(0).getText()}${ctx.iconst() ? `(${ctx.iconst().accept(this)})` : ''}`;
  }

  // INT_P | INTEGER | SMALLINT | BIGINT | REAL | FLOAT_P float_? | DOUBLE_P PRECISION | DECIMAL_P type_modifiers_? | DEC type_modifiers_? | NUMERIC type_modifiers_? | BOOLEAN_P
  visitNumeric (ctx) {
    return ctx.getText();
  }

  // type_function_name attrs? type_modifiers_?
  visitGenerictype (ctx) {
    if (ctx.attrs()) {
      const names = [ctx.getChild(0).getText(), ...ctx.attrs().accept(this)];
      const enumName = last(names);
      const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

      return {
        type: enumName,
        schemaName,
      };
    }
    let type = '';
    if (ctx.type_function_name()) type = ctx.type_function_name().accept(this);
    else type = ctx.getText();

    // example: VARCHAR(255) -> (255) is type_modifiers_
    const modifiers = ctx.type_modifiers_();
    return {
      type: type + (modifiers ? modifiers.getText() : ''),
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

  // (CHARACTER | CHAR_P | NCHAR) varying_?
  // | VARCHAR
  // | NATIONAL (CHARACTER | CHAR_P) varying_?
  visitCharacter_c (ctx) {
    // Generate n element integer array [0, 1, ..., n-1]
    const childIndices = [...Array(ctx.getChildCount()).keys()];
    const text = childIndices.reduce((acc, i) => {
      acc += `${ctx.getChild(i).getText()} `;
      return acc;
    }, '');

    return text.slice(0, text.length - 1); // remove the last whitespace
  }

  // identifier | unreserved_keyword | type_func_name_keyword
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

  // Integral | BinaryIntegral | OctalIntegral | HexadecimalIntegral
  visitIconst (ctx) {
    return Number(ctx.getText()).toString();
  }

  // CREATE unique_? INDEX concurrently_? (if_not_exists_? index_name_)? ON relation_expr access_method_clause? OPEN_PAREN index_params CLOSE_PAREN include_? nulls_distinct? reloptions_? opttablespace? where_clause?
  // | CREATE unique_? INDEX concurrently_? if_not_exists_? name ON relation_expr access_method_clause? OPEN_PAREN index_params CLOSE_PAREN include_? nulls_distinct? reloptions_? opttablespace? where_clause?
  visitIndexstmt (ctx) {
    const names = ctx.relation_expr().accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

    // Get index name from either index_name_ (first grammar alternative) or name (second alternative)
    let indexName = null;
    if (ctx.index_name_()) {
      indexName = ctx.index_name_().accept(this);
    } else if (ctx.name()) {
      indexName = ctx.name().accept(this);
    }

    const accessMethodClause = ctx.access_method_clause();
    return {
      pathName: {
        tableName,
        schemaName,
      },
      index: new Index({
        name: indexName,
        unique: ctx.unique_()?.accept(this) ?? false,
        type: accessMethodClause ? accessMethodClause.accept(this) : undefined,
        columns: ctx.index_params().accept(this),
      }),
    };
  }

  // name
  visitIndex_name_ (ctx) {
    return ctx.name()?.accept(this);
  }

  // colid
  visitName (ctx) {
    return ctx.colid().accept(this);
  }

  // USING name
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
    return ctx.index_elem().map((i) => i.accept(this)).filter((col) => !!col);
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
      };
    }
    return {
      value: ctx.getText(),
      type: CONSTRAINT_TYPE.EXPRESSION,
    };
  }

  // UNIQUE
  visitUnique_ (ctx) {
    return !!ctx.UNIQUE();
  }

  /*
   ALTER TABLE (IF_P EXISTS)? relation_expr (alter_table_cmds | partition_cmd)
   | ALTER TABLE ALL IN_P TABLESPACE name (OWNED BY role_list)? SET TABLESPACE name nowait_?
   | ALTER INDEX (IF_P EXISTS)? qualified_name (alter_table_cmds | index_partition_cmd)
   | ALTER INDEX ALL IN_P TABLESPACE name (OWNED BY role_list)? SET TABLESPACE name nowait_?
   | ALTER SEQUENCE (IF_P EXISTS)? qualified_name alter_table_cmds
   | ALTER VIEW (IF_P EXISTS)? qualified_name alter_table_cmds
   | ALTER MATERIALIZED VIEW (IF_P EXISTS)? qualified_name alter_table_cmds
   | ALTER MATERIALIZED VIEW ALL IN_P TABLESPACE name (OWNED BY role_list)? SET TABLESPACE name nowait_?
   | ALTER FOREIGN TABLE (IF_P EXISTS)? relation_expr alter_table_cmds
   */
  visitAltertablestmt (ctx) {
    if (ctx.TABLE() && ctx.relation_expr() && ctx.alter_table_cmds()) {
      const names = ctx.relation_expr().accept(this);
      const tableName = last(names);
      const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

      const cmds = ctx.alter_table_cmds().accept(this);

      return cmds.map((cmd) => {
        if (!cmd) return null;
        let kind = null;
        switch (cmd.kind) {
          case TABLE_CONSTRAINT_KIND.FK:
            kind = COMMAND_KIND.REF;
            cmd.value.endpoints[0].tableName = tableName;
            cmd.value.endpoints[0].schemaName = schemaName;
            this.data.refs.push(cmd.value);
            break;
          case TABLE_CONSTRAINT_KIND.CHECK: {
            const table = findTable(this.data.tables, schemaName, tableName);
            if (!table) break;
            if (!table.checks) table.checks = [];
            table.checks.push(cmd.value);
            break;
          }
          case TABLE_CONSTRAINT_KIND.UNIQUE:
          case TABLE_CONSTRAINT_KIND.PK:
          case TABLE_CONSTRAINT_KIND.INDEX: {
            if (cmd.value.columns.length === 0) break;
            if (!(cmd.value.pk || cmd.value.unique)) break;

            kind = cmd.kind;
            const table = findTable(this.data.tables, schemaName, tableName);
            if (!table) break;
            if (cmd.value.columns.length === 1 && (cmd.value.unique || cmd.value.pk)) {
              const key = cmd.value.columns[0].value;
              const fieldToUpdate = table.fields.find((f) => f.name === key);
              if (fieldToUpdate) {
                // If we have an exact match, this is a column, if not, might be an expression
                fieldToUpdate[cmd.value.unique ? 'unique' : 'pk'] = true;
                break;
              }
            }
            // multi column constraint -> need to create new index
            const index = new Index({
              name: cmd.value.name,
              columns: cmd.value.columns,
              note: cmd.value.note,
              pk: cmd.value.pk,
              type: cmd.value.type,
              unique: cmd.value.unique,
            });
            table.indexes.push(index);
            break;
          }
          default:
            break;
        }

        return {
          kind,
          value: cmd.value,
        };
      }).filter((c) => c);
    }
  }

  // alter_table_cmd (COMMA alter_table_cmd)*
  visitAlter_table_cmds (ctx) {
    return ctx.alter_table_cmd().map((a) => a.accept(this));
  }

  // check PostgreSQLParser.g4 line 424
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

  // anysconst uescape_?
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
    return ctx.attr_name().map((a) => a.accept(this));
  }

  /*
   CREATE or_replace_? AGGREGATE func_name aggr_args definition
   | CREATE or_replace_? AGGREGATE func_name old_aggr_definition
   | CREATE OPERATOR any_operator definition
   | CREATE TYPE_P any_name definition
   | CREATE TYPE_P any_name
   | CREATE TYPE_P any_name AS OPEN_PAREN opttablefuncelementlist? CLOSE_PAREN
   | CREATE TYPE_P any_name AS ENUM_P OPEN_PAREN enum_val_list_? CLOSE_PAREN
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
    if (ctx.TYPE_P() && ctx.enum_val_list_()) {
      const names = ctx.any_name(0).accept(this);
      const enumName = last(names);
      const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

      const values = ctx.enum_val_list_().accept(this).map((e) => ({ name: e }));
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

  // enum_val_list
  visitEnum_val_list_ (ctx) {
    return ctx.enum_val_list()?.accept(this);
  }

  // sconst (COMMA sconst)*
  visitEnum_val_list (ctx) {
    return ctx.sconst().map((s) => s.accept(this));
  }

  // insertstmt
  //  : with_clause_? INSERT INTO insert_target insert_rest on_conflict_? returning_clause?
  //  ;
  visitInsertstmt (ctx) {
    const names = ctx.insert_target().accept(this);
    const tableName = last(names);
    const schemaName = names.length > 1 ? names[names.length - 2] : undefined;

    const { columns, values } = ctx.insert_rest().accept(this);

    const record = new TableRecord({
      schemaName,
      tableName,
      columns,
      values,
    });

    this.data.records.push(record);
  }

  visitInsert_target (ctx) {
    return ctx.qualified_name().accept(this);
  }

  // insert_rest
  //  : selectstmt
  //  | OVERRIDING override_kind VALUE_P selectstmt
  //  | OPEN_PAREN insert_column_list CLOSE_PAREN (OVERRIDING override_kind VALUE_P)? selectstmt
  //  | DEFAULT VALUES
  //  ;
  visitInsert_rest (ctx) {
    const columns = ctx.insert_column_list() ? ctx.insert_column_list().accept(this) : [];
    const rowsValue = ctx.selectstmt().accept(this) || [];
    // each sub array represents a set of value of a row
    // [
    //   [
    //     { value: '1', type: 'number' },
    //     undefined,
    //     {
    //       value: '{"theme": "dark", "notifications": true}',
    //       type: 'string',
    //       type_name: 'JSONB',
    //       schemaName: null
    //     },
    //     undefined,
    //   ]
    // ]

    const sanitizeRowValue = (rowValue) => {
      return rowValue
        .filter((row) => row)
        .map(({ value, type }) => ({ value, type }));
    };

    const sanitizedRowsValue = rowsValue.filter((rowValue) => Array.isArray(rowValue)).map(sanitizeRowValue);

    return { columns, values: sanitizedRowsValue };
  }

  // insert_column_list
  //  : insert_column_item (COMMA insert_column_item)*
  //  ;
  visitInsert_column_list (ctx) {
    return ctx.insert_column_item().map((colItem) => colItem.accept(this));
  }

  // insert_column_item
  //  : colid opt_indirection
  //  ;
  visitInsert_column_item (ctx) {
    return ctx.colid().accept(this);
  }

  // selectstmt
  //  : select_no_parens
  //  | select_with_parens
  //  ;
  visitSelectstmt (ctx) {
    if (!ctx.select_no_parens()) {
      return null;
    }

    return ctx.select_no_parens().accept(this);
  }

  // select_no_parens
  //  : select_clause sort_clause_? (for_locking_clause select_limit_? | select_limit for_locking_clause_?)?
  //  | with_clause select_clause sort_clause_? (for_locking_clause select_limit_? | select_limit for_locking_clause_?)?
  //  ;
  visitSelect_no_parens (ctx) {
    return ctx.select_clause().accept(this);
  }

  // select_clause
  //  : simple_select_intersect ((UNION | EXCEPT) all_or_distinct? simple_select_intersect)*
  //  ;
  visitSelect_clause (ctx) {
    // Navigate through simple_select_intersect to get values
    const intersects = ctx.simple_select_intersect();
    if (!intersects || intersects.length === 0) {
      return null;
    }
    // For INSERT statements, we typically only care about the first simple_select_intersect
    return intersects[0].accept(this);
  }

  // simple_select_intersect
  //  : simple_select_pramary (INTERSECT all_or_distinct? simple_select_pramary)*
  //  ;
  visitSimple_select_intersect (ctx) {
    // Navigate through simple_select_pramary (note the typo "pramary" in grammar)
    const primaries = ctx.simple_select_pramary();
    if (!primaries || primaries.length === 0) {
      return null;
    }
    // For INSERT statements, we typically only care about the first simple_select_pramary
    return primaries[0].accept(this);
  }

  // simple_select_pramary (note: "pramary" is a typo in the grammar, should be "primary")
  //  : SELECT ... | values_clause | TABLE relation_expr | select_with_parens
  //  ;
  visitSimple_select_pramary (ctx) {
    if (!ctx.values_clause()) {
      return null;
    }

    return ctx.values_clause().accept(this);
  }

  // values_clause
  //  : VALUES OPEN_PAREN expr_list CLOSE_PAREN (COMMA OPEN_PAREN expr_list CLOSE_PAREN)*
  //  ;
  visitValues_clause (ctx) {
    return ctx.expr_list().map((expr) => {
      const rawValues = expr.accept(this);

      // We get the value of the c_expr through:
      // a_expr->a_expr_qual->a_expr_lessless->a_expr_or->a_expr_and->
      // a_expr_between->a_expr_in->a_expr_unary_not->a_expr_isnull->a_expr_is_not->
      // a_expr_compare->a_expr_like->a_expr_qual_op->a_expr_unary_qualop->a_expr_add->
      // a_expr_mul->a_expr_caret->a_expr_unary_sign->a_expr_at_time_zone->a_expr_collate->
      // a_expr_typecast
      const FLATTEN_DEPTH = 21;
      const rawRowValues = flattenDepth(rawValues, FLATTEN_DEPTH);

      // [
      //   { value: '1', type: 'number' },
      //   undefined,
      //   {
      //     value: '{"theme": "dark", "notifications": true}',
      //     type: 'string',
      //     type_name: 'JSONB',
      //     schemaName: null
      //   },
      //   undefined,
      // ]
      return rawRowValues;
    });
  }

  // a_expr_collate
  //  : a_expr_typecast (COLLATE any_name)?
  //  ;
  visitA_expr_collate (ctx) {
    const expressionValueSet = ctx.a_expr_typecast().accept(this);

    // Possible values
    // 1: [ { value: 'inactive', type: 'string' } ]
    // 2: [
    //   { value: '2021-01-05 18:45:00+00', type: 'string' },
    //   undefined,
    //   { type_name: 'TIMESTAMPTZ', schemaName: null }
    // ]

    const [rawValue, _, rawType = {}] = expressionValueSet;
    const { value, type } = rawValue;
    return {
      value,
      type,
      ...rawType,
    };
  }
}
