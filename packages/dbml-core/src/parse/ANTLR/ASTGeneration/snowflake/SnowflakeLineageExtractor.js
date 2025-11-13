/* eslint-disable class-methods-use-this */
import antlr4 from 'antlr4';
import SnowflakeParserVisitor from '../../parsers/snowflake/SnowflakeParserVisitor';
import SnowflakeLexer from '../../parsers/snowflake/SnowflakeLexer';
import SnowflakeParser from '../../parsers/snowflake/SnowflakeParser';
import {
  SqlLineageExtractor,
  LineageResult,
  ColumnMapping,
  TableReference,
} from '../SqlLineageExtractor';
import { getOriginalText } from '../helpers';

export default class SnowflakeLineageExtractor extends SqlLineageExtractor {
  constructor () {
    super();
    this.visitor = new SnowflakeLineageVisitor(this);
  }

  extractLineage (sql, tree = null) {
    try {
      // If tree not provided, parse SQL first
      if (!tree) {
        const chars = new antlr4.InputStream(sql);
        const lexer = new SnowflakeLexer(chars);
        const tokens = new antlr4.CommonTokenStream(lexer);
        const parser = new SnowflakeParser(tokens);

        tree = parser.snowflake_file();
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

class SnowflakeLineageVisitor extends SnowflakeParserVisitor {
  constructor (extractor) {
    super();
    this.extractor = extractor;
  }

  // Root entry point
  visitSnowflake_file (ctx) {
    if (ctx.batch()) {
      ctx.batch().accept(this);
    }
  }

  visitBatch (ctx) {
    const commands = ctx.sql_command();
    if (commands) {
      commands.forEach(cmd => cmd.accept(this));
    }
  }

  visitSql_command (ctx) {
    if (ctx.dml_command()) {
      return ctx.dml_command().accept(this);
    }
  }

  visitDml_command (ctx) {
    if (ctx.insert_statement()) {
      return ctx.insert_statement().accept(this);
    }
    if (ctx.query_statement()) {
      return ctx.query_statement().accept(this);
    }
  }

  // ========== INSERT STATEMENT ==========

  visitInsert_statement (ctx) {
    // Get target table
    const targetNames = ctx.object_name() ? this.parseObjectName(ctx.object_name()) : [];
    const targetTable = targetNames[targetNames.length - 1];
    const targetSchema = targetNames.length > 1 ? targetNames[targetNames.length - 2] : null;

    // Get INSERT columns
    let insertColumns = [];
    if (ctx.column_list_in_parentheses()) {
      const colList = ctx.column_list_in_parentheses();
      if (colList.column_list && colList.column_list()) {
        insertColumns = colList.column_list().accept(this);
      }
    }

    // Get SELECT statement lineage
    if (ctx.query_statement()) {
      this.extractor.pushScope();
      ctx.query_statement().accept(this);
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

  // ========== QUERY STATEMENT (SELECT) ==========

  visitQuery_statement (ctx) {
    // Handle WITH clause (CTEs)
    if (ctx.with_expression()) {
      ctx.with_expression().accept(this);
    }

    // Process SELECT statement
    if (ctx.select_statement()) {
      ctx.select_statement().accept(this);
    }

    // Handle set operators (UNION, INTERSECT, EXCEPT)
    const setOps = ctx.set_operators();
    if (setOps && setOps.length > 0) {
      setOps.forEach(op => {
        if (op.select_statement && op.select_statement()) {
          op.select_statement().accept(this);
        }
      });
    }
  }

  visitWith_expression (ctx) {
    const ctes = ctx.common_table_expression();
    if (ctes) {
      ctes.forEach(cte => cte.accept(this));
    }
  }

  visitCommon_table_expression (ctx) {
    // Get CTE name
    const cteName = ctx.id_() ? ctx.id_().getText() : null;

    if (!cteName) return;

    // Process CTE query in a new scope
    this.extractor.pushScope();

    if (ctx.select_statement()) {
      ctx.select_statement().accept(this);
    }

    // Handle set operators in CTE
    const setOps = ctx.set_operators();
    if (setOps && setOps.length > 0) {
      setOps.forEach(op => {
        if (op.select_statement && op.select_statement()) {
          op.select_statement().accept(this);
        }
      });
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

  visitSelect_statement (ctx) {
    // Process FROM clause first to establish table references
    if (ctx.select_optional_clauses()) {
      const optClauses = ctx.select_optional_clauses();

      if (optClauses.from_clause && optClauses.from_clause()) {
        optClauses.from_clause().accept(this);
      }

      if (optClauses.where_clause && optClauses.where_clause()) {
        optClauses.where_clause().accept(this);
      }
    }

    // Process SELECT clause (column list)
    if (ctx.select_clause()) {
      ctx.select_clause().accept(this);
    } else if (ctx.select_top_clause()) {
      ctx.select_top_clause().accept(this);
    }
  }

  visitSelect_clause (ctx) {
    if (ctx.select_list()) {
      ctx.select_list().accept(this);
    }
  }

  visitSelect_top_clause (ctx) {
    if (ctx.select_list()) {
      ctx.select_list().accept(this);
    }
  }

  visitSelect_list (ctx) {
    // Handle SELECT *
    if (ctx.STAR && ctx.STAR()) {
      this.handleSelectStar(null);
      return;
    }

    // Process each select list item
    const items = ctx.select_list_item();
    if (items) {
      items.forEach(item => item.accept(this));
    }
  }

  visitSelect_list_item (ctx) {
    // Get the expression
    let expression = null;
    if (ctx.expr()) {
      expression = getOriginalText(ctx.expr());
    } else if (ctx.column_name && ctx.column_name()) {
      expression = getOriginalText(ctx.column_name());
    }

    if (!expression) {
      // Check for object_name.*
      if (ctx.object_name && ctx.object_name() && ctx.DOT && ctx.DOT() && ctx.STAR && ctx.STAR()) {
        const objName = ctx.object_name().accept(this);
        const qualifier = objName[objName.length - 1];
        this.handleSelectStar(qualifier);
      }
      return;
    }

    // Get the alias (if any)
    let outputAlias = null;
    if (ctx.as_alias && ctx.as_alias()) {
      const aliasCtx = ctx.as_alias();
      if (aliasCtx.id_ && aliasCtx.id_()) {
        outputAlias = aliasCtx.id_().getText();
      } else if (aliasCtx.string && aliasCtx.string()) {
        outputAlias = aliasCtx.string().getText().replace(/^['"`]|['"`]$/g, '');
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
      sources.forEach(source => source.accept(this));
    } else if (ctx.table_source_item_joined()) {
      // Single source with joins
      ctx.table_source_item_joined().accept(this);
    }
  }

  visitTable_source_item_joined (ctx) {
    // Process the base table source
    if (ctx.object_ref()) {
      ctx.object_ref().accept(this);
    }

    // Handle joins
    const joins = ctx.join_clause();
    if (joins) {
      joins.forEach(join => join.accept(this));
    }
  }

  visitObject_ref (ctx) {
    // Handle regular table reference
    if (ctx.object_name()) {
      const names = ctx.object_name().accept(this);
      const tableName = names[names.length - 1];
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
    if (ctx.query_statement()) {
      const alias = this.getTableAlias(ctx) || 'subquery';

      this.extractor.pushScope();
      ctx.query_statement().accept(this);
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

  visitJoin_clause (ctx) {
    // Process the joined table
    if (ctx.object_ref()) {
      ctx.object_ref().accept(this);
    } else if (ctx.table_source_item_joined()) {
      ctx.table_source_item_joined().accept(this);
    }
  }

  getTableAlias (ctx) {
    // Try to get alias from context
    if (ctx.as_alias && ctx.as_alias()) {
      const aliasCtx = ctx.as_alias();
      if (aliasCtx.id_ && aliasCtx.id_()) {
        return aliasCtx.id_().getText();
      }
      if (aliasCtx.string && aliasCtx.string()) {
        return aliasCtx.string().getText().replace(/^['"`]|['"`]$/g, '');
      }
    }

    return null;
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

  parseObjectName (ctx) {
    const ids = [];

    // object_name can have: [database_name.][schema_name.]object_name_
    if (ctx.id_()) {
      const idList = ctx.id_();
      if (Array.isArray(idList)) {
        return idList.map(id => id.getText());
      }
      return [idList.getText()];
    }

    return [ctx.getText()];
  }

  visitObject_name (ctx) {
    return this.parseObjectName(ctx);
  }

  visitColumn_list (ctx) {
    const names = ctx.column_name();
    if (names) {
      return names.map(name => {
        const parts = this.parseColumnName(name);
        return parts[parts.length - 1]; // Return just the column name
      });
    }
    return [];
  }

  parseColumnName (ctx) {
    if (ctx.id_()) {
      const ids = ctx.id_();
      if (Array.isArray(ids)) {
        return ids.map(id => id.getText());
      }
      return [ids.getText()];
    }
    return [ctx.getText()];
  }

  visitColumn_name (ctx) {
    return this.parseColumnName(ctx);
  }
}
