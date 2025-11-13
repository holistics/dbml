import { parse } from '../index';
import {
  Endpoint, Field, Index, Ref, Table,
} from '../AST';
import PostgresLineageExtractor from '../postgres/PostgresLineageExtractor';
import MySqlLineageExtractor from '../mysql/MySQLLineageExtractor';
import SnowflakeLineageExtractor from '../snowflake/SnowflakeLineageExtractor';
import MssqlLineageExtractor from '../mssql/MssqlLineageExtractor';

/**
 * DbtASTGen - Converts dbt manifest.json to DBML AST
 *
 * This class parses dbt manifest.json files and converts them to the standardized
 * DBML AST format. It supports all adapters that have existing DBML SQL parsers:
 * - postgres
 * - mysql
 * - mssql (sqlserver)
 * - snowflake
 *
 * The importer handles:
 * - Models (tables/views)
 * - Sources (external tables)
 * - Seeds (static data tables)
 * - Snapshots (SCD tables)
 * - Relationship tests (converted to DBML refs)
 * - Other tests (converted to constraints where applicable)
 */
export default class DbtASTGen {
  constructor () {
    this.data = {
      schemas: [],
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      aliases: [],
      project: {},
      records: [],
      deps: [],
    };
    this.manifest = null;
    this.adapterType = null;
    this.lineageExtractor = null;
    this.inferredSourceColumns = new Map(); // Map of source table ID -> Set of column names
  }

  /**
   * Main entry point - parses manifest.json string and returns DBML AST
   * @param {string|Object} manifestInput - The manifest.json content as a string or object
   * @returns {Object} - DBML AST with tables, refs, enums, etc.
   */
  parse (manifestInput) {
    try {
      // Handle both string and object input
      if (typeof manifestInput === 'string') {
        this.manifest = JSON.parse(manifestInput);
      } else if (typeof manifestInput === 'object' && manifestInput !== null) {
        this.manifest = manifestInput;
      } else {
        throw new Error('Invalid input: expected JSON string or object');
      }
    } catch (error) {
      throw new Error(`Invalid manifest.json: ${error.message}`);
    }

    // Detect adapter type and initialize lineage extractor
    this.adapterType = this.detectAdapter();
    this.initializeLineageExtractor();

    // Parse different node types
    this.parseNodes();

    // Parse dbt tests and convert to refs/constraints
    this.parseTests();

    return this.data;
  }

  /**
   * Detects the adapter type from manifest metadata
   * Maps dbt adapter names to DBML parser formats
   */
  detectAdapter () {
    const metadata = this.manifest.metadata || {};
    const adapterType = metadata.adapter_type || 'postgres';

    // Map dbt adapter names to DBML parser formats
    const adapterMap = {
      postgres: 'postgres',
      postgresql: 'postgres',
      redshift: 'postgres', // Redshift uses postgres dialect
      snowflake: 'snowflake',
      mysql: 'mysql',
      sqlserver: 'mssql',
      mssql: 'mssql',
    };

    const mappedAdapter = adapterMap[adapterType.toLowerCase()];

    if (!mappedAdapter) {
      throw new Error(
        `Unsupported adapter type: ${adapterType}. `
        + `Supported adapters: ${Object.keys(adapterMap).join(', ')}`,
      );
    }

    return mappedAdapter;
  }

  /**
   * Initializes the lineage extractor based on the adapter type
   */
  initializeLineageExtractor () {
    const extractorMap = {
      postgres: PostgresLineageExtractor,
      mysql: MySqlLineageExtractor,
      snowflake: SnowflakeLineageExtractor,
      mssql: MssqlLineageExtractor,
    };

    const ExtractorClass = extractorMap[this.adapterType];
    if (ExtractorClass) {
      this.lineageExtractor = new ExtractorClass();
    }
  }

  /**
   * Infers source table columns from compiled SQL in models
   * Scans all nodes with compiled SQL and extracts column references to source tables
   */
  inferSourceColumnsFromSQL () {
    if (!this.lineageExtractor) return;

    const nodes = this.manifest.nodes || {};
    const sources = this.manifest.sources || {};

    // Build a map of source unique_id -> source info for quick lookup
    const sourceMap = new Map();
    Object.entries(sources).forEach(([sourceId, source]) => {
      const schemaName = source.schema || source.source_name;
      const tableName = source.name || source.identifier;
      sourceMap.set(sourceId, { schemaName, tableName, source });
    });

    // Scan all nodes with compiled SQL
    Object.entries(nodes).forEach(([nodeId, node]) => {
      const compiledSQL = node.compiled_code || node.compiled_sql;
      if (!compiledSQL) return;

      try {
        // Extract lineage from compiled SQL
        const lineage = this.lineageExtractor.extractLineage(compiledSQL);

        if (!lineage || !lineage.columnMappings) return;

        // Process each column mapping to find source table references
        lineage.columnMappings.forEach(mapping => {
          if (!mapping.sourceTable || !mapping.sourceColumn) return;

          const sourceSchema = mapping.sourceSchema;
          const sourceTable = mapping.sourceTable;
          const sourceColumn = mapping.sourceColumn;

          // Find matching source in the manifest
          const matchingSource = Array.from(sourceMap.entries()).find(([id, info]) => {
            const tableMatch = info.tableName === sourceTable;
            const schemaMatch = !sourceSchema || info.schemaName === sourceSchema;
            return tableMatch && schemaMatch;
          });

          if (matchingSource) {
            const [sourceId, sourceInfo] = matchingSource;

            // Add column to inferred set
            if (!this.inferredSourceColumns.has(sourceId)) {
              this.inferredSourceColumns.set(sourceId, new Set());
            }
            this.inferredSourceColumns.get(sourceId).add(sourceColumn);
          }
        });
      } catch (error) {
        // Silently skip errors - this is best-effort inference
        console.warn(`Failed to infer columns from ${node.name}: ${error.message}`);
      }
    });
  }

  /**
   * Builds table metadata map for SELECT * expansion
   * Maps table names to their column lists
   */
  buildTableMetadata () {
    const metadata = new Map();

    this.data.tables.forEach(table => {
      const tableName = this.lineageExtractor.normalizeIdentifier(table.name);
      const columns = table.fields.map(f => f.name);
      metadata.set(tableName, columns);

      // Also add with schema prefix
      if (table.schemaName) {
        const qualifiedName = `${table.schemaName}.${table.name}`;
        metadata.set(
          this.lineageExtractor.normalizeIdentifier(qualifiedName),
          columns,
        );
      }
    });

    return metadata;
  }

  /**
   * Extracts column-level dependencies from SQL query
   * Converts lineage result to DBML Dep objects
   */
  extractColumnDependencies (sql, downstreamTable, node) {
    if (!this.lineageExtractor || !sql) {
      return null;
    }

    try {
      // Build table metadata for SELECT * expansion
      const tableMetadata = this.buildTableMetadata();
      this.lineageExtractor.setTableMetadata(tableMetadata);

      // Extract lineage
      const lineage = this.lineageExtractor.extractLineage(sql);

      if (!lineage || lineage.errors.length > 0) {
        // Log errors but don't fail
        lineage.errors.forEach(err => {
          console.warn(`Lineage extraction warning for ${node.name}: ${err}`);
        });
      }

      // Skip if no column mappings found
      if (!lineage.columnMappings || lineage.columnMappings.length === 0) {
        return null;
      }

      // Convert lineage to DBML Dep format
      return this.convertLineageToDep(lineage, downstreamTable, node);
    } catch (error) {
      console.warn(`Failed to extract column dependencies for ${node.name}: ${error.message}`);
      return null;
    }
  }

  /**
   * Converts SQL lineage result to DBML Dep object
   */
  convertLineageToDep (lineage, downstreamTable, node) {
    // Extract CTEs from lineage
    const ctes = [];
    if (lineage.ctes && lineage.ctes.size > 0) {
      lineage.ctes.forEach((cteLineage, cteName) => {
        // Recursively convert CTE lineage to get its upstream tables
        const cteUpstreamTables = [];
        const cteFieldDeps = [];

        cteLineage.columnMappings.forEach(mapping => {
          if (!mapping.sourceTable) return;

          const sourceKey = mapping.sourceSchema
            ? `${mapping.sourceSchema}.${mapping.sourceTable}`
            : mapping.sourceTable;

          // Add to upstream tables if not already present
          if (!cteUpstreamTables.find(t => {
            const key = t.schema ? `${t.schema}.${t.table}` : t.table;
            return key === sourceKey;
          })) {
            const [schema, table] = sourceKey.includes('.') ? sourceKey.split('.') : [null, sourceKey];
            cteUpstreamTables.push({ schema, table });
          }

          // Build field mappings
          const downstreamCol = mapping.outputAlias || mapping.outputColumn;
          cteFieldDeps.push({
            downstreamField: downstreamCol,
            upstreamField: {
              schema: mapping.sourceSchema,
              table: mapping.sourceTable,
              field: mapping.sourceColumn || mapping.outputColumn,
            },
          });
        });

        ctes.push({
          name: cteName,
          fields: cteLineage.columnMappings.map(m => m.outputColumn || m.outputAlias).filter(Boolean),
          upstreamTables: cteUpstreamTables,
          fieldDeps: cteFieldDeps,
        });
      });
    }

    // Group mappings by source table
    const sourceTableMap = new Map();

    lineage.columnMappings.forEach(mapping => {
      if (!mapping.sourceTable) {
        // Skip computed columns without source
        return;
      }

      const sourceKey = mapping.sourceSchema
        ? `${mapping.sourceSchema}.${mapping.sourceTable}`
        : mapping.sourceTable;

      if (!sourceTableMap.has(sourceKey)) {
        sourceTableMap.set(sourceKey, []);
      }

      sourceTableMap.get(sourceKey).push(mapping);
    });

    // Skip if no source tables found
    if (sourceTableMap.size === 0) {
      return null;
    }

    // Build upstream tables list
    const upstreamTables = Array.from(sourceTableMap.keys()).map(key => {
      const [schema, table] = key.includes('.') ? key.split('.') : [null, key];
      return { schema, table };
    });

    // Build field dependencies
    const fieldDeps = [];

    // Group by downstream column
    const downstreamColumnMap = new Map();

    lineage.columnMappings.forEach(mapping => {
      if (!mapping.sourceTable) return;

      const downstreamCol = mapping.outputAlias || mapping.outputColumn;
      if (!downstreamColumnMap.has(downstreamCol)) {
        downstreamColumnMap.set(downstreamCol, []);
      }

      downstreamColumnMap.get(downstreamCol).push(mapping);
    });

    // Create field dependencies
    downstreamColumnMap.forEach((mappings, downstreamCol) => {
      const upstreamFields = mappings.map(m => {
        const sourceTableKey = m.sourceSchema
          ? `${m.sourceSchema}.${m.sourceTable}`
          : m.sourceTable;

        // Find the table index in upstreamTables
        const ownerTableIdx = upstreamTables.findIndex(t => {
          const tableKey = t.schema ? `${t.schema}.${t.table}` : t.table;
          return tableKey === sourceTableKey;
        });

        return {
          ownerTableIdx: ownerTableIdx >= 0 ? ownerTableIdx : 0,
          field: m.sourceColumn || m.outputColumn,
        };
      });

      fieldDeps.push({
        downstreamField: downstreamCol,
        upstreamFields,
        name: null,
        note: null,
      });
    });

    // Return Dep-like object (will be converted to actual Dep in model_structure)
    return {
      name: `${node.name}_lineage`,
      note: {
        value: `Auto-generated from ${node.resource_type} SQL`,
      },
      downstreamTable: {
        schema: downstreamTable.schemaName,
        table: downstreamTable.name,
      },
      upstreamTables,
      fieldDeps: fieldDeps.length > 0 ? fieldDeps : [],
      ctes, // CTEs extracted from the SQL query
    };
  }

  /**
   * Parses all dbt nodes (models, sources, seeds, snapshots)
   */
  parseNodes () {
    const nodes = this.manifest.nodes || {};
    const sources = this.manifest.sources || {};

    // Infer source columns from compiled SQL before parsing sources
    // Note: This requires lineageExtractor to be initialized first
    if (this.lineageExtractor) {
      this.inferSourceColumnsFromSQL();
    }

    // Parse models, seeds, and snapshots
    Object.entries(nodes).forEach(([nodeId, node]) => {
      const resourceType = node.resource_type;

      if (resourceType === 'model') {
        this.parseModel(node);
      } else if (resourceType === 'seed') {
        this.parseSeed(node);
      } else if (resourceType === 'snapshot') {
        this.parseSnapshot(node);
      }
    });

    // Parse sources
    Object.entries(sources).forEach(([sourceId, source]) => {
      this.parseSource(source, sourceId);
    });

    // Parse disabled nodes if they exist
    this.parseDisabledNodes();

    // NOW extract dependencies - after all tables (including sources) have been created
    this.extractAllDependencies();

    // Extract unique schemas and convert to schema objects
    const schemaSet = new Set(this.data.tables.map(t => t.schemaName).filter(Boolean));
    this.data.schemas = Array.from(schemaSet).map(schemaName => ({ name: schemaName }));
  }

  /**
   * Extracts dependencies for all models in a second pass
   * This must happen after all tables (including sources) have been created
   */
  extractAllDependencies () {
    this.data.tables.forEach(table => {
      // Check if this table has a stored node with compiled SQL
      if (table._dbtNode) {
        const node = table._dbtNode;

        if (node.compiled_code || node.compiled_sql) {
          try {
            const compiledSql = node.compiled_code || node.compiled_sql;
            const dep = this.extractColumnDependencies(compiledSql, table, node);

            if (dep) {
              this.data.deps.push(dep);
            }
          } catch (error) {
            console.warn(`Failed to extract lineage for ${node.resource_type} ${node.name}: ${error.message}`);
          }
        }

        // Clean up temporary reference
        delete table._dbtNode;
      }
    });
  }

  /**
   * Parses a dbt model and converts it to a DBML Table
   */
  parseModel (node) {
    const table = this.createTableFromNode(node);

    // Try to infer columns if none are defined
    if ((!table.fields || table.fields.length === 0) && (node.compiled_code || node.compiled_sql)) {
      const compiledSql = node.compiled_code || node.compiled_sql;

      // Try to extract column information from SQL lineage
      if (this.lineageExtractor) {
        try {
          // Build table metadata from already-created tables to support SELECT * expansion
          const tableMetadata = this.buildTableMetadata();
          this.lineageExtractor.setTableMetadata(tableMetadata);

          const lineage = this.lineageExtractor.extractLineage(compiledSql);
          if (lineage && lineage.columnMappings && lineage.columnMappings.length > 0) {
            // Use the output columns from lineage as table columns
            const inferredColumns = lineage.columnMappings.map(mapping =>
              mapping.outputColumn || mapping.outputAlias
            ).filter(Boolean);

            if (inferredColumns.length > 0) {
              table.fields = inferredColumns.map(colName => new Field({
                name: colName,
                type: { type_name: 'string', schemaName: null },
                note: 'Inferred from SQL',
              }));
              console.log(`Inferred ${inferredColumns.length} columns for model ${node.name} from SQL`);
            }
          }
        } catch (error) {
          console.warn(`Failed to infer columns for model ${node.name}: ${error.message}`);
        }
      }
    }

    // If still no columns, skip the table
    if (!table.fields || table.fields.length === 0) {
      console.warn(`Skipping model ${node.name}: no columns defined or inferred`);
      return;
    }

    // Try to parse compiled SQL for additional structure
    if (node.compiled_code || node.compiled_sql) {
      try {
        const compiledSql = node.compiled_code || node.compiled_sql;
        const parsedSql = parse(compiledSql, this.adapterType);

        // Merge SQL-parsed structure with manifest metadata
        this.mergeTableStructure(table, parsedSql.tables);
      } catch (error) {
        // If SQL parsing fails, continue with manifest metadata only
        console.warn(`Failed to parse SQL for model ${node.name}: ${error.message}`);
      }
    }

    this.data.tables.push(table);

    // Store node for second-pass dependency extraction
    // Dependencies must be extracted AFTER all tables (including sources) are created
    table._dbtNode = node;
  }

  /**
   * Parses a dbt seed and converts it to a DBML Table
   */
  parseSeed (node) {
    const table = this.createTableFromNode(node);

    // Skip tables without columns - DBML requires at least one field
    if (!table.fields || table.fields.length === 0) {
      console.warn(`Skipping seed ${node.name}: no columns defined`);
      return;
    }

    this.data.tables.push(table);
  }

  /**
   * Parses a dbt snapshot and converts it to a DBML Table
   */
  parseSnapshot (node) {
    const table = this.createTableFromNode(node);

    // Skip tables without columns - DBML requires at least one field
    if (!table.fields || table.fields.length === 0) {
      console.warn(`Skipping snapshot ${node.name}: no columns defined`);
      return;
    }

    // Add snapshot-specific metadata to note
    const snapshotNote = `Snapshot table (strategy: ${node.config?.strategy || 'unknown'})`;
    table.note = table.note ? `${table.note}\n\n${snapshotNote}` : snapshotNote;

    this.data.tables.push(table);
  }

  /**
   * Parses a dbt source and converts it to a DBML Table
   */
  parseSource (source, sourceId) {
    const schemaName = source.schema || source.source_name;
    const tableName = source.name || source.identifier;

    let fields = this.extractFields(source.columns);

    // If no columns defined in manifest, try to use inferred columns from SQL
    if ((!fields || fields.length === 0) && sourceId && this.inferredSourceColumns.has(sourceId)) {
      const inferredCols = Array.from(this.inferredSourceColumns.get(sourceId));
      console.log(`Using ${inferredCols.length} inferred columns for source ${tableName}`);

      fields = inferredCols.map(colName => new Field({
        name: colName,
        type: { type_name: 'string', schemaName: null }, // Unknown type, use string as default
        not_null: false,
        pk: false,
        unique: false,
        note: 'Inferred from compiled SQL',
      }));
    }

    // If still no columns, create a placeholder column to satisfy DBML requirements
    if (!fields || fields.length === 0) {
      console.warn(`Source ${tableName} has no columns defined or inferred, adding placeholder`);
      fields = [new Field({
        name: '__unknown__',
        type: { type_name: 'string', schemaName: null },
        not_null: false,
        pk: false,
        unique: false,
        note: 'Placeholder column - actual schema not available in manifest',
      })];
    }

    const note = this.createNote(source);

    const tableConfig = {
      name: tableName,
      fields,
      indexes: [],
      note,
      source: 'dbt',
    };

    if (schemaName) {
      tableConfig.schemaName = schemaName;
    }

    const table = new Table(tableConfig);

    this.data.tables.push(table);
  }

  /**
   * Parses disabled nodes from manifest.json if present
   */
  parseDisabledNodes () {
    const disabled = this.manifest.disabled || {};

    // Parse disabled sources
    if (disabled.sources) {
      Object.entries(disabled.sources).forEach(([sourceId, source]) => {
        // Add a note that this is disabled
        const originalNote = source.description || '';
        source.description = originalNote
          ? `${originalNote}\n\nNote: This source is disabled in dbt.`
          : 'Note: This source is disabled in dbt.';

        this.parseSource(source, sourceId);
      });
    }

    // Parse disabled models
    if (disabled.nodes) {
      Object.entries(disabled.nodes).forEach(([nodeId, node]) => {
        const resourceType = node.resource_type;

        // Add a note that this is disabled
        const originalNote = node.description || '';
        node.description = originalNote
          ? `${originalNote}\n\nNote: This ${resourceType} is disabled in dbt.`
          : `Note: This ${resourceType} is disabled in dbt.`;

        if (resourceType === 'model') {
          this.parseModel(node);
        } else if (resourceType === 'seed') {
          this.parseSeed(node);
        } else if (resourceType === 'snapshot') {
          this.parseSnapshot(node);
        }
      });
    }
  }

  /**
   * Creates a Table object from a dbt node (model/seed/snapshot)
   */
  createTableFromNode (node) {
    const schemaName = node.schema || node.database;
    const tableName = node.name || node.alias;

    const fields = this.extractFields(node.columns);
    const note = this.createNote(node);

    const tableConfig = {
      name: tableName,
      fields,
      indexes: [],
      note,
      source: 'dbt',
    };

    if (schemaName) {
      tableConfig.schemaName = schemaName;
    }

    return new Table(tableConfig);
  }

  /**
   * Extracts fields from dbt column definitions
   */
  extractFields (columns) {
    if (!columns) return [];

    return Object.entries(columns).map(([colName, colDef]) => {
      const field = new Field({
        name: colDef.name || colName,
        type: this.parseColumnType(colDef.data_type || colDef.type || 'string'),
        not_null: false, // Will be determined from tests
        pk: false, // Will be determined from tests
        unique: false, // Will be determined from tests
        note: colDef.description || null,
      });

      return field;
    });
  }

  /**
   * Parses column type and returns type object
   */
  parseColumnType (dataType) {
    if (!dataType) return { type_name: 'string', schemaName: null };

    // Clean up type string
    const typeName = String(dataType).toLowerCase().trim();

    return {
      type_name: typeName,
      schemaName: null,
    };
  }

  /**
   * Creates note from dbt node metadata
   */
  createNote (node) {
    const parts = [];

    if (node.description) {
      parts.push(node.description);
    }

    if (node.tags && node.tags.length > 0) {
      parts.push(`Tags: ${node.tags.join(', ')}`);
    }

    if (node.meta && Object.keys(node.meta).length > 0) {
      parts.push(`Metadata: ${JSON.stringify(node.meta)}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  /**
   * Merges SQL-parsed structure with manifest metadata
   */
  mergeTableStructure (manifestTable, parsedTables) {
    if (!parsedTables || parsedTables.length === 0) return;

    // Find matching table from parsed SQL (usually the first/only one)
    const parsedTable = parsedTables[0];

    // Merge fields - prefer manifest metadata but add SQL-derived info
    if (parsedTable.fields && parsedTable.fields.length > 0) {
      const fieldMap = new Map(
        manifestTable.fields.map(f => [f.name.toLowerCase(), f]),
      );

      parsedTable.fields.forEach(sqlField => {
        const manifestField = fieldMap.get(sqlField.name.toLowerCase());

        if (manifestField) {
          // Merge: keep manifest note, but update constraints from SQL
          manifestField.not_null = manifestField.not_null || sqlField.not_null;
          manifestField.pk = manifestField.pk || sqlField.pk;
          manifestField.unique = manifestField.unique || sqlField.unique;
          manifestField.increment = manifestField.increment || sqlField.increment;
          manifestField.dbdefault = manifestField.dbdefault || sqlField.dbdefault;

          // Preserve SQL field note if manifest doesn't have one
          if (!manifestField.note && sqlField.note) {
            manifestField.note = sqlField.note;
          }

          // Update type if manifest doesn't have it or SQL has more specific info
          if (!manifestField.type || !manifestField.type.type_name) {
            manifestField.type = sqlField.type;
          }
        } else {
          // Field found in SQL but not in manifest - add it
          manifestTable.fields.push(sqlField);
        }
      });
    }

    // Add indexes from parsed SQL
    if (parsedTable.indexes && parsedTable.indexes.length > 0) {
      manifestTable.indexes = parsedTable.indexes;
    }
  }

  /**
   * Parses dbt tests and converts them to DBML refs and constraints
   */
  parseTests () {
    const nodes = this.manifest.nodes || {};

    Object.entries(nodes).forEach(([nodeId, node]) => {
      if (node.resource_type === 'test') {
        this.parseTest(node);
      }
    });
  }

  /**
   * Parses individual test and applies it to tables/fields
   */
  parseTest (test) {
    const testMetadata = test.test_metadata || {};
    const testName = testMetadata.name || test.name;

    // Handle relationship tests - convert to refs
    if (testName === 'relationships') {
      this.parseRelationshipTest(test);
      return;
    }

    // Handle other tests - apply as constraints
    this.applyTestConstraint(test, testName);
  }

  /**
   * Converts a dbt relationship test to a DBML Ref
   */
  parseRelationshipTest (test) {
    try {
      const testMetadata = test.test_metadata || {};
      const kwargs = testMetadata.kwargs || {};

      // Extract relationship information
      const toTable = kwargs.to || kwargs.model;
      const toField = kwargs.field;

      // Use attached_node to find the source table (the table the test is defined on)
      const fromNode = test.attached_node || test.depends_on?.nodes?.[0];

      if (!toTable || !toField || !fromNode) {
        console.warn(`Incomplete relationship test: ${test.name}`);
        return;
      }

      // Parse from node (source table)
      const fromNodeData = this.manifest.nodes[fromNode] || this.manifest.sources[fromNode];
      if (!fromNodeData) {
        console.warn(`Skipping relationship test ${test.name}: source node ${fromNode} not found`);
        return;
      }

      const fromSchema = fromNodeData.schema;
      const fromTable = fromNodeData.name;
      const fromField = test.column_name;

      // Parse to reference (may be in format "ref('table')" or just "table")
      const toTableMatch = toTable.match(/ref\(['"](.*?)['"]\)/);
      const toTableName = toTableMatch ? toTableMatch[1] : toTable;

      // Find the target table in our data
      const targetTable = this.data.tables.find(
        t => t.name === toTableName,
      );

      // Find the source table in our data
      const sourceTable = this.data.tables.find(
        t => t.name === fromTable,
      );

      // Skip if either table doesn't exist (may have been filtered out)
      if (!targetTable) {
        console.warn(`Skipping relationship test ${test.name}: target table ${toTableName} not found`);
        return;
      }

      if (!sourceTable) {
        console.warn(`Skipping relationship test ${test.name}: source table ${fromTable} not found`);
        return;
      }

      const toSchema = targetTable?.schemaName || fromSchema;

      // Create DBML Ref
      // In DBML, the convention is: many side > one side
      // So fromTable (many) > toTable (one)
      const ref = new Ref({
        endpoints: [
          new Endpoint({
            tableName: toTableName,
            schemaName: toSchema,
            fieldNames: [toField],
            relation: '1',
          }),
          new Endpoint({
            tableName: fromTable,
            schemaName: fromSchema,
            fieldNames: [fromField],
            relation: '*', // many-to-one by default
          }),
        ],
      });

      this.data.refs.push(ref);
    } catch (error) {
      console.warn(`Failed to parse relationship test: ${error.message}`);
    }
  }

  /**
   * Applies test as constraint to table/field
   */
  applyTestConstraint (test, testName) {
    try {
      const fromNode = test.depends_on?.nodes?.[0];
      if (!fromNode) return;

      const fromNodeData = this.manifest.nodes[fromNode] || this.manifest.sources[fromNode];
      if (!fromNodeData) return;

      const tableName = fromNodeData.name;
      const schemaName = fromNodeData.schema;
      const columnName = test.column_name;

      // Find the table
      const table = this.data.tables.find(
        t => t.name === tableName && (!schemaName || t.schemaName === schemaName),
      );

      if (!table) return;

      // Apply constraint based on test type
      if (testName === 'not_null' && columnName) {
        const field = table.fields.find(f => f.name === columnName);
        if (field) field.not_null = true;
      } else if (testName === 'unique' && columnName) {
        const field = table.fields.find(f => f.name === columnName);
        if (field) field.unique = true;
      } else if (testName === 'unique' && !columnName) {
        // Table-level unique constraint
        const testMetadata = test.test_metadata || {};
        const kwargs = testMetadata.kwargs || {};
        const columns = kwargs.column_name ? [kwargs.column_name] : [];

        if (columns.length > 0) {
          const index = new Index({
            name: `${tableName}_${columns.join('_')}_unique`,
            unique: true,
            pk: false,
            columns: columns.map(col => ({ value: col, type: 'column' })),
          });
          table.indexes.push(index);
        }
      }
    } catch (error) {
      console.warn(`Failed to apply test constraint: ${error.message}`);
    }
  }
}
