/**
 * Base class for SQL lineage extraction
 * Provides common functionality for tracking column-level dependencies in SQL queries
 */

export class ColumnMapping {
  constructor ({
    outputColumn, // Output column name (with alias applied)
    outputAlias, // Alias specified in SELECT clause
    sourceTable, // Source table name
    sourceSchema, // Source schema name
    sourceColumn, // Source column name
    expression, // Original SQL expression
    isSelectStar, // Whether this came from SELECT *
    isComputed, // Whether this is a computed column (expression, not direct reference)
  }) {
    this.outputColumn = outputColumn;
    this.outputAlias = outputAlias;
    this.sourceTable = sourceTable;
    this.sourceSchema = sourceSchema;
    this.sourceColumn = sourceColumn;
    this.expression = expression;
    this.isSelectStar = isSelectStar || false;
    this.isComputed = isComputed || false;
  }
}

export class TableReference {
  constructor ({
    tableName, // Table name
    schemaName, // Schema name
    alias, // Table alias
    isSubquery, // Whether this is a subquery
    isCte, // Whether this is a CTE
    columns, // Available columns (for SELECT * expansion)
  }) {
    this.tableName = tableName;
    this.schemaName = schemaName;
    this.alias = alias;
    this.isSubquery = isSubquery || false;
    this.isCte = isCte || false;
    this.columns = columns || [];
  }

  getQualifiedName () {
    if (this.schemaName) {
      return `${this.schemaName}.${this.tableName}`;
    }
    return this.tableName;
  }

  getReferenceName () {
    return this.alias || this.tableName;
  }
}

export class LineageResult {
  constructor () {
    this.columnMappings = []; // Array of ColumnMapping objects
    this.tableReferences = []; // Array of TableReference objects
    this.ctes = new Map(); // Map of CTE name -> LineageResult
    this.hasSelectStar = false; // Whether query contains SELECT *
    this.errors = []; // Array of error messages
  }

  addColumnMapping (mapping) {
    this.columnMappings.push(mapping);
  }

  addTableReference (ref) {
    this.tableReferences.push(ref);
  }

  addCTE (name, lineageResult) {
    this.ctes.set(name, lineageResult);
  }

  addError (error) {
    this.errors.push(error);
  }

  getTableByAlias (alias) {
    return this.tableReferences.find(ref => ref.alias === alias || ref.tableName === alias);
  }
}

export class SqlLineageExtractor {
  constructor () {
    this.currentScope = null; // Current lineage scope
    this.scopeStack = []; // Stack of lineage scopes (for nested queries)
    this.tableMetadata = new Map(); // Map of table name -> column list
  }

  /**
   * Set available table metadata for SELECT * expansion
   * @param {Map<string, Array<string>>} metadata - Map of table names to column arrays
   */
  setTableMetadata (metadata) {
    this.tableMetadata = metadata;
  }

  /**
   * Push a new scope for processing nested queries
   */
  pushScope () {
    if (this.currentScope) {
      this.scopeStack.push(this.currentScope);
    }
    this.currentScope = new LineageResult();
  }

  /**
   * Pop the current scope and return it
   */
  popScope () {
    const scope = this.currentScope;
    this.currentScope = this.scopeStack.pop() || null;
    return scope;
  }

  /**
   * Extract lineage from SQL query
   * Override in subclasses
   */
  extractLineage (sql) {
    throw new Error('extractLineage() must be implemented by subclass');
  }

  /**
   * Normalize identifier (remove quotes, handle case sensitivity)
   */
  normalizeIdentifier (identifier) {
    if (!identifier) return null;

    // Remove surrounding quotes (`, ", [, ])
    const normalized = identifier.replace(/^[`"\[]|[`"\]]$/g, '');

    // Convert to lowercase for case-insensitive comparison
    // (Most SQL dialects are case-insensitive for identifiers)
    return normalized.toLowerCase();
  }

  /**
   * Parse qualified column reference (schema.table.column or table.column)
   */
  parseQualifiedName (qualifiedName) {
    if (!qualifiedName) return { schema: null, table: null, column: null };

    const parts = qualifiedName.split('.').map(p => this.normalizeIdentifier(p));

    if (parts.length === 3) {
      return { schema: parts[0], table: parts[1], column: parts[2] };
    } if (parts.length === 2) {
      return { schema: null, table: parts[0], column: parts[1] };
    }
    return { schema: null, table: null, column: parts[0] };
  }

  /**
   * Resolve column reference to source table
   * Handles table aliases and qualified names
   */
  resolveColumnSource (columnName, tableQualifier = null) {
    if (!this.currentScope) return null;

    const normalizedColumn = this.normalizeIdentifier(columnName);

    if (tableQualifier) {
      // Column has explicit table qualifier (e.g., t1.id)
      const normalizedQualifier = this.normalizeIdentifier(tableQualifier);
      const table = this.currentScope.getTableByAlias(normalizedQualifier);

      if (table) {
        return {
          table: table.tableName,
          schema: table.schemaName,
          column: normalizedColumn,
        };
      }
    } else {
      // No qualifier - search all tables in scope
      for (const table of this.currentScope.tableReferences) {
        if (this.tableHasColumn(table, normalizedColumn)) {
          return {
            table: table.tableName,
            schema: table.schemaName,
            column: normalizedColumn,
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if a table has a specific column
   */
  tableHasColumn (tableRef, columnName) {
    // If we have column metadata for this table, check it
    const tableName = tableRef.getQualifiedName();
    const metadata = this.tableMetadata.get(tableName)
                     || this.tableMetadata.get(this.normalizeIdentifier(tableRef.tableName));

    if (metadata && Array.isArray(metadata)) {
      return metadata.some(col => this.normalizeIdentifier(col) === this.normalizeIdentifier(columnName));
    }

    // If no metadata, assume column exists (optimistic approach)
    // This handles cases where we don't have full table schema
    return true;
  }

  /**
   * Expand SELECT * for a specific table or all tables
   */
  expandSelectStar (tableRef = null) {
    const mappings = [];

    if (tableRef) {
      // Expand for specific table (e.g., table.*)
      const columns = this.getTableColumns(tableRef);
      for (const column of columns) {
        mappings.push(new ColumnMapping({
          outputColumn: column,
          outputAlias: column,
          sourceTable: tableRef.tableName,
          sourceSchema: tableRef.schemaName,
          sourceColumn: column,
          expression: '*',
          isSelectStar: true,
          isComputed: false,
        }));
      }
    } else {
      // Expand for all tables in scope
      if (!this.currentScope) return mappings;

      for (const table of this.currentScope.tableReferences) {
        const columns = this.getTableColumns(table);
        for (const column of columns) {
          mappings.push(new ColumnMapping({
            outputColumn: column,
            outputAlias: column,
            sourceTable: table.tableName,
            sourceSchema: table.schemaName,
            sourceColumn: column,
            expression: '*',
            isSelectStar: true,
            isComputed: false,
          }));
        }
      }
    }

    return mappings;
  }

  /**
   * Get columns for a table reference
   */
  getTableColumns (tableRef) {
    // First check if columns are directly provided (for CTEs/subqueries)
    if (tableRef.columns && tableRef.columns.length > 0) {
      return tableRef.columns;
    }

    // Check table metadata
    const tableName = tableRef.getQualifiedName();
    const metadata = this.tableMetadata.get(tableName)
                     || this.tableMetadata.get(this.normalizeIdentifier(tableRef.tableName));

    if (metadata && Array.isArray(metadata)) {
      return metadata;
    }

    // No metadata available - return empty array
    // Caller should handle this appropriately
    return [];
  }

  /**
   * Check if an expression is a simple column reference (not a computed expression)
   */
  isSimpleColumnReference (expression) {
    if (!expression) return false;

    // Simple column reference patterns:
    // - columnName
    // - table.columnName
    // - schema.table.columnName
    const simplePattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
    const quotedPattern = /^(`[^`]+`|"[^"]+"|\[[^\]]+\])(\.[a-zA-Z_][a-zA-Z0-9_]*|\.`[^`]+`|\.\"[^\"]+\"|\.\\[[^\\]]+\\])*$/;

    return simplePattern.test(expression.trim()) || quotedPattern.test(expression.trim());
  }
}
