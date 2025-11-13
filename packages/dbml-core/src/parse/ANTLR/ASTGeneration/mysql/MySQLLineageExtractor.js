/* eslint-disable class-methods-use-this */
import { last } from 'lodash';
import antlr4 from 'antlr4';
import MySQLParserVisitor from '../../parsers/mysql/MySqlParserVisitor';
import MySQLLexer from '../../parsers/mysql/MySqlLexer';
import MySQLParser from '../../parsers/mysql/MySqlParser';
import {
  SqlLineageExtractor,
  LineageResult,
  ColumnMapping,
  TableReference,
} from '../SqlLineageExtractor';
import { getOriginalText } from '../helpers';

export default class MySqlLineageExtractor extends SqlLineageExtractor {
  constructor () {
    super();
    this.visitor = new MySqlLineageVisitor(this);
  }

  extractLineage (sql, tree = null) {
    try {
      // If tree not provided, parse SQL first
      if (!tree) {
        const chars = new antlr4.InputStream(sql);
        const lexer = new MySQLLexer(chars);
        const tokens = new antlr4.CommonTokenStream(lexer);
        const parser = new MySQLParser(tokens);

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

class MySqlLineageVisitor extends MySQLParserVisitor {
  constructor (extractor) {
    super();
    this.extractor = extractor;
  }

  // Root entry point
  visitRoot (ctx) {
    if (ctx.sqlStatements()) {
      ctx.sqlStatements().accept(this);
    }
  }

  visitSqlStatements (ctx) {
    const stmts = ctx.sqlStatement();
    if (stmts) {
      stmts.forEach(stmt => stmt.accept(this));
    }
  }

  visitSqlStatement (ctx) {
    if (ctx.dmlStatement()) {
      return ctx.dmlStatement().accept(this);
    }
  }

  visitDmlStatement (ctx) {
    if (ctx.insertStatement()) {
      return ctx.insertStatement().accept(this);
    }
    if (ctx.selectStatement()) {
      return ctx.selectStatement().accept(this);
    }
  }

  // ========== INSERT STATEMENT ==========

  visitInsertStatement (ctx) {
    // Get target table
    const targetNames = ctx.tableName() ? ctx.tableName().accept(this) : [];
    const targetTable = last(targetNames);
    const targetSchema = targetNames.length > 1 ? targetNames[targetNames.length - 2] : null;

    // Get INSERT columns
    const insertColumns = ctx.fullColumnNameList() ? ctx.fullColumnNameList().accept(this) : [];

    // Get SELECT statement lineage
    const insertValue = ctx.insertStatementValue();
    if (insertValue) {
      const selectLineage = insertValue.accept(this);

      if (selectLineage && selectLineage.columnMappings) {
        // Map INSERT columns to SELECT columns
        const selectColumns = selectLineage.columnMappings || [];

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
        selectLineage.tableReferences.forEach(ref => {
          this.extractor.currentScope.addTableReference(ref);
        });
      }
    }
  }

  visitFullColumnNameList (ctx) {
    const columns = ctx.fullColumnName();
    if (columns) {
      return columns.map(col => {
        const parts = col.accept(this);
        return last(parts); // Get just the column name
      });
    }
    return [];
  }

  visitInsertStatementValue (ctx) {
    // Check if this is INSERT ... SELECT
    if (ctx.selectStatement()) {
      // Create a new scope for the SELECT
      this.extractor.pushScope();
      ctx.selectStatement().accept(this);
      return this.extractor.popScope();
    }

    // Otherwise it's INSERT ... VALUES - not relevant for lineage
    return null;
  }

  // ========== SELECT STATEMENT ==========

  visitSelectStatement (ctx) {
    // Handle CTE (WITH clause)
    if (ctx.withClause && ctx.withClause()) {
      ctx.withClause().accept(this);
    }

    // Process query specification or expression
    if (ctx.querySpecification()) {
      return ctx.querySpecification().accept(this);
    }

    if (ctx.queryExpression()) {
      return ctx.queryExpression().accept(this);
    }

    // Handle parenthesized select
    if (ctx.selectStatement()) {
      const selects = ctx.selectStatement();
      if (Array.isArray(selects)) {
        selects.forEach(s => s.accept(this));
      } else {
        return selects.accept(this);
      }
    }
  }

  visitWithClause (ctx) {
    // Process each CTE
    const ctes = ctx.commonTableExpressions && ctx.commonTableExpressions();
    if (ctes) {
      ctes.accept(this);
    }
  }

  visitCommonTableExpressions (ctx) {
    const cteList = ctx.cteName();
    if (cteList) {
      cteList.forEach((cte, index) => {
        const cteName = cte.getText();
        const queries = ctx.selectStatement();

        if (queries && queries[index]) {
          // Process CTE query in a new scope
          this.extractor.pushScope();
          queries[index].accept(this);
          const cteLineage = this.extractor.popScope();

          // Register CTE as a table reference
          const cteColumns = cteLineage.columnMappings.map(m => m.outputColumn || m.outputAlias);
          const cteRef = new TableReference({
            tableName: this.extractor.normalizeIdentifier(cteName),
            schemaName: null,
            alias: this.extractor.normalizeIdentifier(cteName),
            isCTE: true,
            columns: cteColumns,
          });

          this.extractor.currentScope.addTableReference(cteRef);
          this.extractor.currentScope.addCTE(this.extractor.normalizeIdentifier(cteName), cteLineage);
        }
      });
    }
  }

  visitQueryExpression (ctx) {
    if (ctx.querySpecification()) {
      return ctx.querySpecification().accept(this);
    }

    if (ctx.queryExpression()) {
      const queries = ctx.queryExpression();
      if (Array.isArray(queries)) {
        queries.forEach(q => q.accept(this));
      } else {
        return queries.accept(this);
      }
    }
  }

  visitQuerySpecification (ctx) {
    // Process FROM clause first
    if (ctx.fromClause()) {
      ctx.fromClause().accept(this);
    }

    // Process WHERE clause
    if (ctx.whereExpr && ctx.whereExpr()) {
      ctx.whereExpr().accept(this);
    }

    // Process SELECT elements
    if (ctx.selectElements()) {
      return ctx.selectElements().accept(this);
    }
  }

  // ========== FROM CLAUSE ==========

  visitFromClause (ctx) {
    if (ctx.tableSources()) {
      return ctx.tableSources().accept(this);
    }
  }

  visitTableSources (ctx) {
    const sources = ctx.tableSource();
    if (sources) {
      sources.forEach(source => source.accept(this));
    }
  }

  visitTableSource (ctx) {
    // Handle table source item
    if (ctx.tableSourceItem()) {
      ctx.tableSourceItem().accept(this);
    }

    // Handle joined tables
    const joinParts = ctx.joinPart();
    if (joinParts) {
      joinParts.forEach(join => join.accept(this));
    }
  }

  visitTableSourceItem (ctx) {
    // Handle regular table
    if (ctx.tableName()) {
      const names = ctx.tableName().accept(this);
      const tableName = last(names);
      const schemaName = names.length > 1 ? names[names.length - 2] : null;

      // Get table alias
      const alias = this.getTableAlias(ctx) || tableName;

      const tableRef = new TableReference({
        tableName: this.extractor.normalizeIdentifier(tableName),
        schemaName: schemaName ? this.extractor.normalizeIdentifier(schemaName) : null,
        alias: this.extractor.normalizeIdentifier(alias),
      });

      this.extractor.currentScope.addTableReference(tableRef);
      return tableRef;
    }

    // Handle subquery
    if (ctx.selectStatement()) {
      const alias = this.getTableAlias(ctx) || 'subquery';

      this.extractor.pushScope();
      ctx.selectStatement().accept(this);
      const subqueryLineage = this.extractor.popScope();

      const subqueryColumns = subqueryLineage.columnMappings.map(m => m.outputColumn || m.outputAlias);
      const subqueryRef = new TableReference({
        tableName: alias,
        schemaName: null,
        alias: this.extractor.normalizeIdentifier(alias),
        isSubquery: true,
        columns: subqueryColumns,
      });

      this.extractor.currentScope.addTableReference(subqueryRef);
    }

    // Handle parenthesized table sources
    if (ctx.tableSources()) {
      return ctx.tableSources().accept(this);
    }
  }

  visitJoinPart (ctx) {
    // Handle joined table source
    if (ctx.tableSourceItem()) {
      return ctx.tableSourceItem().accept(this);
    }
  }

  getTableAlias (ctx) {
    // Try to get alias from context
    if (ctx.uid && ctx.uid()) {
      const uids = ctx.uid();
      if (Array.isArray(uids)) {
        return uids[uids.length - 1].getText();
      }
      return uids.getText();
    }

    if (ctx.alias && ctx.alias()) {
      return ctx.alias().getText();
    }

    return null;
  }

  // ========== SELECT ELEMENTS ==========

  visitSelectElements (ctx) {
    const elements = ctx.selectElement();
    if (elements) {
      elements.forEach(elem => elem.accept(this));
    }
  }

  visitSelectElement (ctx) {
    // Handle SELECT *
    if (ctx.STAR && ctx.STAR()) {
      this.handleSelectStar(null);
      return;
    }

    // Handle table.* or schema.table.*
    if (ctx.STAR && ctx.fullId && ctx.fullId()) {
      const qualifier = ctx.fullId().getText();
      this.handleSelectStar(qualifier);
      return;
    }

    // Get the column expression
    let expression = null;
    if (ctx.fullColumnName && ctx.fullColumnName()) {
      expression = getOriginalText(ctx.fullColumnName());
    } else if (ctx.functionCall && ctx.functionCall()) {
      expression = getOriginalText(ctx.functionCall());
    } else if (ctx.expression && ctx.expression()) {
      expression = getOriginalText(ctx.expression());
    }

    if (!expression) return;

    // Get the alias (if any)
    let outputAlias = null;
    if (ctx.uid && ctx.uid()) {
      outputAlias = ctx.uid().getText();
    } else if (ctx.STRING_LITERAL && ctx.STRING_LITERAL()) {
      outputAlias = ctx.STRING_LITERAL().getText().replace(/^['"`]|['"`]$/g, '');
    }

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

  visitTableName (ctx) {
    if (ctx.fullId()) {
      return ctx.fullId().accept(this);
    }
    return [ctx.getText()];
  }

  visitFullId (ctx) {
    const ids = ctx.uid();
    if (ids) {
      if (Array.isArray(ids)) {
        return ids.map(id => id.getText());
      }
      return [ids.getText()];
    }
    return [ctx.getText()];
  }

  visitFullColumnName (ctx) {
    const uid = ctx.uid();
    if (uid) {
      if (Array.isArray(uid)) {
        return uid.map(id => id.getText());
      }
      return [uid.getText()];
    }
    return [ctx.getText()];
  }

  visitUid (ctx) {
    return ctx.getText();
  }
}
