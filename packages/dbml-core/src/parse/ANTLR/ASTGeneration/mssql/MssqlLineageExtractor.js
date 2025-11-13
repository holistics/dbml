/* eslint-disable class-methods-use-this */
import { last, nth } from 'lodash';
import antlr4 from 'antlr4';
import TSqlParserVisitor from '../../parsers/mssql/TSqlParserVisitor';
import TSqlLexer from '../../parsers/mssql/TSqlLexer';
import TSqlParser from '../../parsers/mssql/TSqlParser';
import {
  SqlLineageExtractor,
  LineageResult,
  ColumnMapping,
  TableReference,
} from '../SqlLineageExtractor';
import { getOriginalText } from '../helpers';

export default class MssqlLineageExtractor extends SqlLineageExtractor {
  constructor () {
    super();
    this.visitor = new MssqlLineageVisitor(this);
  }

  extractLineage (sql, tree = null) {
    try {
      // If tree not provided, parse SQL first
      if (!tree) {
        const chars = new antlr4.InputStream(sql);
        const lexer = new TSqlLexer(chars);
        const tokens = new antlr4.CommonTokenStream(lexer);
        const parser = new TSqlParser(tokens);

        tree = parser.tsql_file();
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

class MssqlLineageVisitor extends TSqlParserVisitor {
  constructor (extractor) {
    super();
    this.extractor = extractor;
  }

  // Root entry point
  visitTsql_file (ctx) {
    if (ctx.batch()) {
      const batches = ctx.batch();
      if (Array.isArray(batches)) {
        batches.forEach(batch => batch.accept(this));
      } else {
        batches.accept(this);
      }
    }
  }

  visitBatch (ctx) {
    const statements = ctx.sql_clauses();
    if (statements) {
      statements.accept(this);
    }
  }

  visitSql_clauses (ctx) {
    const clauses = ctx.sql_clause();
    if (clauses) {
      if (Array.isArray(clauses)) {
        clauses.forEach(clause => clause.accept(this));
      } else {
        clauses.accept(this);
      }
    }
  }

  visitSql_clause (ctx) {
    if (ctx.dml_clause()) {
      return ctx.dml_clause().accept(this);
    }
  }

  visitDml_clause (ctx) {
    if (ctx.insert_statement()) {
      return ctx.insert_statement().accept(this);
    }
    if (ctx.select_statement_standalone()) {
      return ctx.select_statement_standalone().accept(this);
    }
  }

  // ========== INSERT STATEMENT ==========

  visitInsert_statement (ctx) {
    // Get target table
    const targetNames = ctx.ddl_object() ? ctx.ddl_object().accept(this) : [];
    const targetTable = last(targetNames);
    const targetSchema = targetNames.length > 1 ? nth(targetNames, -2) : null;

    // Get INSERT columns
    const insertColumns = ctx.insert_column_name_list() ? ctx.insert_column_name_list().accept(this) : [];

    // Handle WITH clause (CTEs) if present
    if (ctx.with_expression()) {
      ctx.with_expression().accept(this);
    }

    // Get SELECT statement lineage
    const insertValue = ctx.insert_statement_value();
    if (insertValue && insertValue.derived_table && insertValue.derived_table()) {
      // INSERT ... SELECT case
      this.extractor.pushScope();

      // Copy CTEs from parent scope to child scope
      if (this.extractor.scopeStack.length > 0) {
        const parentScope = this.extractor.scopeStack[this.extractor.scopeStack.length - 1];
        parentScope.ctes.forEach((lineage, name) => {
          this.extractor.currentScope.addCTE(name, lineage);
          // Also add as table reference
          const cteColumns = lineage.columnMappings.map(m => m.outputColumn || m.outputAlias);
          this.extractor.currentScope.addTableReference(new TableReference({
            tableName: name,
            schemaName: null,
            alias: name,
            isCTE: true,
            columns: cteColumns,
          }));
        });
      }

      insertValue.derived_table().accept(this);
      const selectLineage = this.extractor.popScope();

      if (selectLineage && selectLineage.columnMappings) {
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

  visitDdl_object (ctx) {
    if (ctx.full_table_name()) {
      return ctx.full_table_name().accept(this);
    }
    return [];
  }

  visitFull_table_name (ctx) {
    const ids = ctx.id_();
    if (ids) {
      return ids.map(id => id.accept(this));
    }
    return [];
  }

  visitInsert_column_name_list (ctx) {
    const columns = ctx.insert_column_id();
    if (columns) {
      return columns.map(col => {
        const parts = col.accept(this);
        return last(parts); // Get just the column name
      });
    }
    return [];
  }

  visitInsert_column_id (ctx) {
    const ids = ctx.id_();
    if (ids) {
      return ids.map(id => id.accept(this));
    }
    return [];
  }

  // ========== SELECT STATEMENT ==========

  visitSelect_statement_standalone (ctx) {
    // Handle WITH clause (CTEs)
    if (ctx.with_expression()) {
      ctx.with_expression().accept(this);
    }

    // Process SELECT statement
    if (ctx.select_statement()) {
      return ctx.select_statement().accept(this);
    }
  }

  visitSelect_statement (ctx) {
    if (ctx.query_expression()) {
      return ctx.query_expression().accept(this);
    }
  }

  visitWith_expression (ctx) {
    const ctes = ctx.common_table_expression();
    if (ctes) {
      if (Array.isArray(ctes)) {
        ctes.forEach(cte => cte.accept(this));
      } else {
        ctes.accept(this);
      }
    }
  }

  visitCommon_table_expression (ctx) {
    // Get CTE name
    const cteName = ctx.expression_name() ? this.getIdentifierText(ctx.expression_name()) : null;

    if (!cteName) return;

    // Process CTE query in a new scope
    this.extractor.pushScope();

    if (ctx.select_statement()) {
      ctx.select_statement().accept(this);
    }

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

  visitQuery_expression (ctx) {
    // Process main query specification
    if (ctx.query_specification()) {
      ctx.query_specification().accept(this);
    }

    // Handle UNION, INTERSECT, EXCEPT
    const unions = ctx.sql_union();
    if (unions) {
      if (Array.isArray(unions)) {
        unions.forEach(union => {
          if (union.query_specification && union.query_specification()) {
            union.query_specification().accept(this);
          }
        });
      } else if (unions.query_specification && unions.query_specification()) {
        unions.query_specification().accept(this);
      }
    }

    // Handle parenthesized query expression
    const subQueries = ctx.query_expression();
    if (subQueries) {
      if (Array.isArray(subQueries)) {
        subQueries.forEach(q => q.accept(this));
      } else {
        subQueries.accept(this);
      }
    }
  }

  visitQuery_specification (ctx) {
    // Process FROM clause first
    if (ctx.from_clause()) {
      ctx.from_clause().accept(this);
    }

    // Process WHERE clause
    if (ctx.where_clause()) {
      ctx.where_clause().accept(this);
    }

    // Process SELECT list
    if (ctx.select_list()) {
      ctx.select_list().accept(this);
    }
  }

  // ========== FROM CLAUSE ==========

  visitFrom_clause (ctx) {
    const sources = ctx.table_sources();
    if (sources) {
      sources.accept(this);
    }
  }

  visitTable_sources (ctx) {
    const sources = ctx.table_source();
    if (sources) {
      if (Array.isArray(sources)) {
        sources.forEach(source => source.accept(this));
      } else {
        sources.accept(this);
      }
    }
  }

  visitTable_source (ctx) {
    // Process table source item
    if (ctx.table_source_item()) {
      ctx.table_source_item().accept(this);
    }

    // Handle joins
    const joins = ctx.join_part();
    if (joins) {
      if (Array.isArray(joins)) {
        joins.forEach(join => join.accept(this));
      } else {
        joins.accept(this);
      }
    }
  }

  visitTable_source_item (ctx) {
    // Handle regular table
    if (ctx.table_name_with_hint()) {
      return ctx.table_name_with_hint().accept(this);
    }

    // Handle derived table (subquery)
    if (ctx.derived_table()) {
      const alias = this.getTableAlias(ctx) || 'subquery';

      this.extractor.pushScope();

      // Copy CTEs from parent scope
      if (this.extractor.scopeStack.length > 0) {
        const parentScope = this.extractor.scopeStack[this.extractor.scopeStack.length - 1];
        parentScope.ctes.forEach((lineage, name) => {
          this.extractor.currentScope.addCTE(name, lineage);
          const cteColumns = lineage.columnMappings.map(m => m.outputColumn || m.outputAlias);
          this.extractor.currentScope.addTableReference(new TableReference({
            tableName: name,
            schemaName: null,
            alias: name,
            isCTE: true,
            columns: cteColumns,
          }));
        });
      }

      ctx.derived_table().accept(this);
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
  }

  visitTable_name_with_hint (ctx) {
    if (ctx.table_name()) {
      const names = ctx.table_name().accept(this);
      const tableName = last(names);
      const schemaName = names.length > 1 ? nth(names, -2) : null;

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
  }

  visitTable_name (ctx) {
    const ids = ctx.id_();
    if (ids) {
      return ids.map(id => id.accept(this));
    }
    return [];
  }

  visitDerived_table (ctx) {
    // Process subquery
    if (ctx.select_statement()) {
      return ctx.select_statement().accept(this);
    }
    if (ctx.query_specification()) {
      return ctx.query_specification().accept(this);
    }
  }

  visitJoin_part (ctx) {
    // Process joined table source
    if (ctx.table_source()) {
      return ctx.table_source().accept(this);
    }
  }

  getTableAlias (ctx) {
    // Try to get alias from context
    if (ctx.as_table_alias && ctx.as_table_alias()) {
      const aliasCtx = ctx.as_table_alias();
      if (aliasCtx.table_alias && aliasCtx.table_alias()) {
        return this.getIdentifierText(aliasCtx.table_alias());
      }
    }

    if (ctx.table_alias && ctx.table_alias()) {
      return this.getIdentifierText(ctx.table_alias());
    }

    return null;
  }

  // ========== SELECT LIST ==========

  visitSelect_list (ctx) {
    // Handle SELECT *
    if (ctx.STAR && ctx.STAR()) {
      this.handleSelectStar(null);
      return;
    }

    // Process each select element
    const elements = ctx.select_list_elem();
    if (elements) {
      if (Array.isArray(elements)) {
        elements.forEach(elem => elem.accept(this));
      } else {
        elements.accept(this);
      }
    }
  }

  visitSelect_list_elem (ctx) {
    // Handle table.* or schema.table.*
    if (ctx.STAR && ctx.STAR()) {
      let qualifier = null;
      if (ctx.table_name && ctx.table_name()) {
        const names = ctx.table_name().accept(this);
        qualifier = last(names);
      }
      this.handleSelectStar(qualifier);
      return;
    }

    // Get the expression
    let expression = null;
    if (ctx.expression()) {
      expression = getOriginalText(ctx.expression());
    }

    if (!expression) return;

    // Get the alias (if any)
    let outputAlias = null;
    if (ctx.column_alias && ctx.column_alias()) {
      outputAlias = this.getIdentifierText(ctx.column_alias());
    } else if (ctx.as_column_alias && ctx.as_column_alias()) {
      const asAlias = ctx.as_column_alias();
      if (asAlias.column_alias && asAlias.column_alias()) {
        outputAlias = this.getIdentifierText(asAlias.column_alias());
      }
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

  visitId_ (ctx) {
    if (ctx.DOUBLE_QUOTE_ID && ctx.DOUBLE_QUOTE_ID()) {
      return getOriginalText(ctx).slice(1, -1);
    }
    if (ctx.SQUARE_BRACKET_ID && ctx.SQUARE_BRACKET_ID()) {
      return getOriginalText(ctx).slice(1, -1);
    }
    return getOriginalText(ctx);
  }

  getIdentifierText (ctx) {
    if (ctx.id_ && ctx.id_()) {
      return ctx.id_().accept(this);
    }
    return ctx.getText();
  }
}
