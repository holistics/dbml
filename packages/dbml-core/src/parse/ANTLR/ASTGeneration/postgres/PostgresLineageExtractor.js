/* eslint-disable class-methods-use-this */
import antlr4 from 'antlr4';
import PostgreSQLParserVisitor from '../../parsers/postgresql/PostgreSQLParserVisitor';
import PostgreSQLLexer from '../../parsers/postgresql/PostgreSQLLexer';
import PostgreSQLParser from '../../parsers/postgresql/PostgreSQLParser';
import {
  SqlLineageExtractor,
  LineageResult,
  ColumnMapping,
  TableReference,
} from '../SqlLineageExtractor';
import { getOriginalText } from '../helpers';

export default class PostgresLineageExtractor extends SqlLineageExtractor {
  constructor () {
    super();
    this.visitor = new PostgresLineageVisitor(this);
  }

  extractLineage (sql, tree = null) {
    try {
      // If tree not provided, parse SQL first
      if (!tree) {
        const chars = new antlr4.InputStream(sql);
        const lexer = new PostgreSQLLexer(chars);
        const tokens = new antlr4.CommonTokenStream(lexer);
        const parser = new PostgreSQLParser(tokens);

        tree = parser.root();
      }

      this.pushScope();
      tree.accept(this.visitor);
      return this.popScope();
    } catch (error) {
      const result = new LineageResult();
      result.addError(`Failed to extract lineage: ${error.message}`);
      return result;
    }
  }
}

class PostgresLineageVisitor extends PostgreSQLParserVisitor {
  constructor (extractor) {
    super();
    this.extractor = extractor;
  }

  // Root entry point
  visitRoot (ctx) {
    if (ctx.stmtblock()) {
      ctx.stmtblock().accept(this);
    }
  }

  visitStmtblock (ctx) {
    if (ctx.stmtmulti()) {
      ctx.stmtmulti().accept(this);
    }
  }

  visitStmtmulti (ctx) {
    const stmts = ctx.stmt();
    if (stmts && stmts.length > 0) {
      // Process each statement
      stmts.forEach(stmt => stmt.accept(this));
    }
  }

  visitStmt (ctx) {
    // Handle INSERT statements
    if (ctx.insertstmt()) {
      return ctx.insertstmt().accept(this);
    }

    // Handle standalone SELECT statements
    if (ctx.selectstmt && ctx.selectstmt()) {
      return ctx.selectstmt().accept(this);
    }
  }

  // ========== INSERT STATEMENT ==========

  visitInsertstmt (ctx) {
    // Get target table
    const targetNames = ctx.insert_target() ? ctx.insert_target().accept(this) : [];
    const targetTable = targetNames[targetNames.length - 1];
    const targetSchema = targetNames.length > 1 ? targetNames[targetNames.length - 2] : null;

    // Get INSERT columns and SELECT lineage
    const insertRest = ctx.insert_rest() ? ctx.insert_rest().accept(this) : {};

    if (insertRest.selectLineage) {
      // Map INSERT columns to SELECT columns
      const insertColumns = insertRest.insertColumns || [];
      const selectColumns = insertRest.selectLineage.columnMappings || [];

      // Create column mappings for INSERT
      for (let i = 0; i < Math.min(insertColumns.length, selectColumns.length); i++) {
        const insertCol = insertColumns[i];
        const selectCol = selectColumns[i];

        this.extractor.currentScope.addColumnMapping(new ColumnMapping({
          outputColumn: insertCol,
          outputAlias: insertCol,
          sourceTable: selectCol.sourceTable,
          sourceSchema: selectCol.sourceSchema,
          sourceColumn: selectCol.sourceColumn || selectCol.outputColumn,
          expression: selectCol.expression,
          isSelectStar: selectCol.isSelectStar,
          isComputed: selectCol.isComputed,
        }));
      }

      // Add table references from the SELECT
      insertRest.selectLineage.tableReferences.forEach(ref => {
        this.extractor.currentScope.addTableReference(ref);
      });
    }
  }

  visitInsert_target (ctx) {
    return ctx.qualified_name() ? ctx.qualified_name().accept(this) : [];
  }

  visitInsert_rest (ctx) {
    // Get INSERT column list
    const insertColumns = ctx.insert_column_list() ? ctx.insert_column_list().accept(this) : [];

    // Get SELECT statement lineage
    let selectLineage = null;
    if (ctx.selectstmt()) {
      // Create a new scope for the SELECT
      this.extractor.pushScope();
      ctx.selectstmt().accept(this);
      selectLineage = this.extractor.popScope();
    }

    return { insertColumns, selectLineage };
  }

  visitInsert_column_list (ctx) {
    return ctx.insert_column_item().map(item => item.accept(this));
  }

  visitInsert_column_item (ctx) {
    return ctx.colid() ? ctx.colid().accept(this) : null;
  }

  // ========== SELECT STATEMENT ==========

  visitSelectstmt (ctx) {
    if (ctx.select_no_parens()) {
      return ctx.select_no_parens().accept(this);
    }
    if (ctx.select_with_parens()) {
      return ctx.select_with_parens().accept(this);
    }
  }

  visitSelect_with_parens (ctx) {
    if (ctx.select_no_parens()) {
      return ctx.select_no_parens().accept(this);
    }
    if (ctx.select_with_parens()) {
      return ctx.select_with_parens().accept(this);
    }
  }

  visitSelect_no_parens (ctx) {
    // Handle WITH clause (CTEs)
    if (ctx.with_clause()) {
      ctx.with_clause().accept(this);
    }

    // Process the main SELECT clause
    if (ctx.select_clause()) {
      return ctx.select_clause().accept(this);
    }
  }

  visitWith_clause (ctx) {
    // Process each CTE
    const ctes = ctx.cte_list();
    if (ctes) {
      ctes.accept(this);
    }
  }

  visitCte_list (ctx) {
    const cteItems = ctx.common_table_expr();
    if (cteItems) {
      cteItems.forEach(cte => cte.accept(this));
    }
  }

  visitCommon_table_expr (ctx) {
    // Get CTE name
    const cteName = ctx.name() ? this.extractor.normalizeIdentifier(ctx.name().getText()) : null;

    if (!cteName) return;

    // Process CTE query in a new scope
    this.extractor.pushScope();

    if (ctx.preparablestmt && ctx.preparablestmt()) {
      ctx.preparablestmt().accept(this);
    }

    const cteLineage = this.extractor.popScope();

    // Register CTE as a table reference with its output columns
    const cteColumns = cteLineage.columnMappings.map(m => m.outputColumn || m.outputAlias);
    const cteRef = new TableReference({
      tableName: cteName,
      schemaName: null,
      alias: cteName,
      isCTE: true,
      columns: cteColumns,
    });

    this.extractor.currentScope.addTableReference(cteRef);
    this.extractor.currentScope.addCTE(cteName, cteLineage);
  }

  visitPreparablestmt (ctx) {
    if (ctx.selectstmt()) {
      return ctx.selectstmt().accept(this);
    }
  }

  visitSelect_clause (ctx) {
    if (ctx.simple_select()) {
      return ctx.simple_select().accept(this);
    }
    const selectWithParens = ctx.select_with_parens();
    if (selectWithParens && !Array.isArray(selectWithParens) && typeof selectWithParens.accept === 'function') {
      return selectWithParens.accept(this);
    }
  }

  visitSimple_select (ctx) {
    // Check for SELECT with opt_target_list
    let targetList = null;
    if (ctx.opt_target_list && ctx.opt_target_list()) {
      const optTargetList = ctx.opt_target_list();
      if (optTargetList.target_list) {
        targetList = optTargetList.target_list();
      }
    }

    if (targetList) {
      // Process FROM clause first to establish table references
      if (ctx.from_clause()) {
        ctx.from_clause().accept(this);
      }

      // Process WHERE clause (for additional context)
      if (ctx.where_clause && ctx.where_clause()) {
        ctx.where_clause().accept(this);
      }

      // Process target list (SELECT columns)
      return targetList.accept(this);
    }

    // Handle UNION/INTERSECT/EXCEPT
    if (ctx.simple_select()) {
      const selects = ctx.simple_select();
      if (Array.isArray(selects)) {
        selects.forEach(s => s.accept(this));
      } else {
        selects.accept(this);
      }
    }

    // Handle subquery with parentheses
    const selectWithParens = ctx.select_with_parens();
    if (selectWithParens && !Array.isArray(selectWithParens) && typeof selectWithParens.accept === 'function') {
      return selectWithParens.accept(this);
    }
  }

  // ========== FROM CLAUSE ==========

  visitFrom_clause (ctx) {
    if (ctx.from_list()) {
      return ctx.from_list().accept(this);
    }
  }

  visitFrom_list (ctx) {
    const items = ctx.table_ref();
    if (items) {
      items.forEach(item => item.accept(this));
    }
  }

  visitTable_ref (ctx) {
    // Handle relation_expr (table reference)
    if (ctx.relation_expr()) {
      return ctx.relation_expr().accept(this);
    }

    // Handle joined tables
    if (ctx.joined_table()) {
      return ctx.joined_table().accept(this);
    }

    // Handle subquery
    if (ctx.select_with_parens()) {
      // Subquery in FROM clause
      const alias = this.getTableAlias(ctx);

      this.extractor.pushScope();
      ctx.select_with_parens().accept(this);
      const subqueryLineage = this.extractor.popScope();

      const subqueryColumns = subqueryLineage.columnMappings.map(m => m.outputColumn || m.outputAlias);
      const subqueryRef = new TableReference({
        tableName: alias || 'subquery',
        schemaName: null,
        alias,
        isSubquery: true,
        columns: subqueryColumns,
      });

      this.extractor.currentScope.addTableReference(subqueryRef);
    }

    // Handle function call (table function)
    if (ctx.func_table && ctx.func_table()) {
      // TODO: Handle table-valued functions
    }
  }

  visitRelation_expr (ctx) {
    // Get qualified table name
    const names = ctx.qualified_name() ? ctx.qualified_name().accept(this) : [];
    const tableName = names[names.length - 1];
    const schemaName = names.length > 1 ? names[names.length - 2] : null;

    // Get table alias if present
    const alias = this.getTableAlias(ctx) || tableName;

    const tableRef = new TableReference({
      tableName: this.extractor.normalizeIdentifier(tableName),
      schemaName: schemaName ? this.extractor.normalizeIdentifier(schemaName) : null,
      alias: this.extractor.normalizeIdentifier(alias),
    });

    this.extractor.currentScope.addTableReference(tableRef);
    return tableRef;
  }

  visitJoined_table (ctx) {
    // Handle left side of JOIN
    if (ctx.table_ref && ctx.table_ref()) {
      const tableRefs = ctx.table_ref();
      if (Array.isArray(tableRefs)) {
        tableRefs.forEach(ref => ref.accept(this));
      } else {
        tableRefs.accept(this);
      }
    }

    // Handle joined table expression
    if (ctx.joined_table()) {
      const joinedTables = ctx.joined_table();
      if (Array.isArray(joinedTables)) {
        joinedTables.forEach(jt => jt.accept(this));
      } else {
        joinedTables.accept(this);
      }
    }
  }

  getTableAlias (ctx) {
    // Try to get alias from various contexts
    if (ctx.alias_clause && ctx.alias_clause()) {
      const aliasCtx = ctx.alias_clause();
      if (aliasCtx.colid && aliasCtx.colid()) {
        return aliasCtx.colid().getText();
      }
      if (aliasCtx.identifier && aliasCtx.identifier()) {
        return aliasCtx.identifier().getText();
      }
    }

    if (ctx.colid && ctx.colid()) {
      return ctx.colid().getText();
    }

    return null;
  }

  // ========== TARGET LIST (SELECT columns) ==========

  visitTarget_list (ctx) {
    const targets = ctx.target_el();
    if (targets) {
      targets.forEach(target => target.accept(this));
    }
  }

  visitTarget_star (ctx) {
    // Handle table.* or schema.table.*
    if (ctx.colid && ctx.colid()) {
      const qualifier = ctx.colid().getText();
      this.handleSelectStar(qualifier);
      return;
    }

    // Handle SELECT * (all tables)
    this.handleSelectStar(null);
  }

  visitTarget_label (ctx) {
    // Get the expression
    const expression = ctx.a_expr() ? getOriginalText(ctx.a_expr()) : null;

    // Get the alias (if any)
    let outputAlias = null;
    if (ctx.identifier && ctx.identifier()) {
      outputAlias = ctx.identifier().getText();
    } else if (ctx.IDENT && ctx.IDENT()) {
      outputAlias = ctx.IDENT().getText();
    }

    if (!expression) return;

    // Try to parse the expression to determine source
    const isSimple = this.extractor.isSimpleColumnReference(expression);

    if (isSimple) {
      // Simple column reference - resolve to source table
      const parsed = this.extractor.parseQualifiedName(expression);
      const resolved = this.extractor.resolveColumnSource(parsed.column, parsed.table);

      if (resolved) {
        this.extractor.currentScope.addColumnMapping(new ColumnMapping({
          outputColumn: outputAlias || parsed.column,
          outputAlias: outputAlias || parsed.column,
          sourceTable: resolved.table,
          sourceSchema: resolved.schema,
          sourceColumn: resolved.column,
          expression,
          isComputed: false,
        }));
      } else {
        // Couldn't resolve - add as computed
        this.extractor.currentScope.addColumnMapping(new ColumnMapping({
          outputColumn: outputAlias || expression,
          outputAlias: outputAlias || expression,
          sourceTable: null,
          sourceSchema: null,
          sourceColumn: null,
          expression,
          isComputed: true,
        }));
      }
    } else {
      // Complex expression - mark as computed
      this.extractor.currentScope.addColumnMapping(new ColumnMapping({
        outputColumn: outputAlias || expression,
        outputAlias: outputAlias || expression,
        sourceTable: null,
        sourceSchema: null,
        sourceColumn: null,
        expression,
        isComputed: true,
      }));
    }
  }

  handleSelectStar (qualifier) {
    if (qualifier) {
      // table.* or schema.table.*
      const normalized = this.extractor.normalizeIdentifier(qualifier);
      const tableRef = this.extractor.currentScope.getTableByAlias(normalized);

      if (tableRef) {
        const mappings = this.extractor.expandSelectStar(tableRef);
        mappings.forEach(m => this.extractor.currentScope.addColumnMapping(m));
      } else {
        this.extractor.currentScope.hasSelectStar = true;
        this.extractor.currentScope.addError(`Could not resolve table for ${qualifier}.*`);
      }
    } else {
      // SELECT * (all tables)
      const mappings = this.extractor.expandSelectStar(null);

      if (mappings.length === 0) {
        // No metadata available for expansion
        this.extractor.currentScope.hasSelectStar = true;
      } else {
        mappings.forEach(m => this.extractor.currentScope.addColumnMapping(m));
      }
    }
  }

  // ========== HELPER METHODS ==========

  visitQualified_name (ctx) {
    const names = [];

    // First identifier via colid
    const colid = ctx.colid();
    if (colid) {
      names.push(colid.getText());
    }

    // Rest via indirection
    const indirection = ctx.indirection();
    if (indirection && indirection.indirection_el) {
      const elems = indirection.indirection_el();
      if (Array.isArray(elems)) {
        elems.forEach(elem => {
          // Each indirection_el contains attr_name
          if (elem.attr_name) {
            const attrName = elem.attr_name();
            if (attrName) {
              names.push(attrName.getText());
            }
          } else {
            // Fallback: get text and remove leading dot
            let text = elem.getText();
            if (text.startsWith('.')) {
              text = text.substring(1);
            }
            names.push(text);
          }
        });
      }
    }

    return names;
  }

  visitIndirection_el (ctx) {
    if (ctx.attr_name && ctx.attr_name()) {
      return ctx.attr_name().accept(this);
    }
    return ctx.getText();
  }

  visitAttr_name (ctx) {
    return ctx.collabel() ? ctx.collabel().accept(this) : ctx.getText();
  }

  visitCollabel (ctx) {
    return ctx.getText();
  }

  visitColid (ctx) {
    return ctx.getText();
  }

  visitName (ctx) {
    return ctx.getText();
  }

  visitIdentifier (ctx) {
    return ctx.getText();
  }
}
