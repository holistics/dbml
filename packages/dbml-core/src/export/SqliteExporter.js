/* eslint-disable max-len */
import _ from 'lodash';
import {
  buildJunctionFields1,
  buildJunctionFields2,
  buildNewTableName,
} from './utils';
import { shouldPrintSchemaName } from '../model_structure/utils';

// SQLite doesn't have schemas or built-in rich types; we use affinities.
// Basic mapping from common Postgres types (and typical custom names) to SQLite affinities.
const SQLITE_TYPE_MAP = (() => {
  const int = new Set(['SMALLINT', 'INT2', 'INTEGER', 'INT', 'INT4', 'BIGINT', 'INT8',
    'SMALLSERIAL', 'SERIAL', 'BIGSERIAL']);
  const real = new Set(['REAL', 'FLOAT', 'DOUBLE', 'DOUBLE PRECISION', 'NUMERIC(.*)']); // NUMERIC often -> NUMERIC, but many use REAL for decimals
  const num = new Set(['DECIMAL', 'NUMERIC']);
  const text = new Set(['CHAR', 'CHARACTER', 'NCHAR', 'NVARCHAR', 'VARCHAR', 'CHARACTER VARYING', 'TEXT', 'NAME', 'BPCHAR', 'UUID', 'XML', 'JSON', 'JSONB', 'INET', 'CIDR', 'MACADDR', 'MACADDR8']);
  const blob = new Set(['BYTEA', 'BLOB']);
  const date = new Set(['DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITHOUT TIME ZONE', 'TIME WITH TIME ZONE', 'TIME WITHOUT TIME ZONE', 'INTERVAL']);
  const bool = new Set(['BOOLEAN', 'BOOL']);
  return { int, real, num, text, blob, date, bool };
})();

// Normalize incoming type name (strip params, collapse spaces)
function normalizeTypeName (tn) {
  const t = (tn || '').trim().replace(/\s+/g, ' ').toUpperCase();
  return t.replace(/\(.*\)$/, ''); // drop length/precision for mapping
}

function mapTypeToSQLite (originalTypeName) {
  const t = normalizeTypeName(originalTypeName);

  if (SQLITE_TYPE_MAP.int.has(t)) return 'INTEGER';
  if (SQLITE_TYPE_MAP.bool.has(t)) return 'INTEGER'; // (optionally add CHECK later)
  if (SQLITE_TYPE_MAP.blob.has(t)) return 'BLOB';
  if (SQLITE_TYPE_MAP.text.has(t)) return 'TEXT';
  if (SQLITE_TYPE_MAP.date.has(t)) return 'TEXT'; // store ISO strings; alternative: NUMERIC
  if (SQLITE_TYPE_MAP.num.has(t)) return 'NUMERIC';
  if (t === 'REAL' || t === 'FLOAT' || t === 'DOUBLE' || t === 'DOUBLE PRECISION') return 'REAL';

  // Fallback: try to infer by keywords
  if (/INT/i.test(t)) return 'INTEGER';
  if (/CHAR|CLOB|TEXT/i.test(t)) return 'TEXT';
  if (/BLOB/i.test(t)) return 'BLOB';
  if (/REAL|FLOA|DOUB/i.test(t)) return 'REAL';
  if (/NUM|DEC|MONEY/i.test(t)) return 'NUMERIC';

  // Unknown/custom → TEXT to be safe
  return 'TEXT';
}

class SqliteExporter {
  // Build enum name → value array map so we can add CHECK constraints
  static buildEnumMap (model) {
    const map = new Map();
    Object.keys(model.enums).forEach((enumId) => {
      const e = model.enums[enumId];
      const schema = model.schemas[e.schemaId];
      // Fully qualified DBML enum name (schema may exist in model, but SQLite won’t use it)
      const fq = `"${schema.name}"."${e.name}"`;
      const local = `"${e.name}"`;
      const vals = e.valueIds.map(id => model.enumValues[id].name);
      map.set(fq, vals);
      map.set(local, vals);
      map.set(e.name, vals); // convenience
    });
    return map;
  }

  // Collect per-table FK clauses (since SQLite needs inline FKs)
  static collectForeignKeysByTable (refIds, model) {
    const fksByTableId = new Map(); // tableId -> array of fk clause strings
    const junctionCreates = []; // CREATE TABLE strings for M:N junctions (with inline FKs)

    const usedTableNames = new Set(Object.values(model.tables).map(t => t.name));

    (refIds || []).forEach((refId) => {
      const ref = model.refs[refId];
      const refOneIndex = ref.endpointIds.findIndex(endpointId => model.endpoints[endpointId].relation === '1');
      const refEndpointIndex = refOneIndex === -1 ? 0 : refOneIndex;
      const foreignEndpointId = ref.endpointIds[1 - refEndpointIndex];
      const refEndpointId = ref.endpointIds[refEndpointIndex];
      const foreignEndpoint = model.endpoints[foreignEndpointId];
      const refEndpoint = model.endpoints[refEndpointId];

      const refField = model.fields[refEndpoint.fieldIds[0]];
      const refTable = model.tables[refField.tableId];
      const foreignField = model.fields[foreignEndpoint.fieldIds[0]];
      const foreignTable = model.tables[foreignField.tableId];

      const refCols = SqliteExporter.buildFieldName(refEndpoint.fieldIds, model); // "(colA, colB)"
      const foreignCols = SqliteExporter.buildFieldName(foreignEndpoint.fieldIds, model);

      if (refOneIndex === -1) {
        // Many-to-many: build a junction table with FKs inline
        const firstTableFieldsMap = buildJunctionFields1(refEndpoint.fieldIds, model);
        const secondTableFieldsMap = buildJunctionFields2(foreignEndpoint.fieldIds, model, firstTableFieldsMap);
        const newTableName = buildNewTableName(refTable.name, foreignTable.name, usedTableNames);

        let line = `CREATE TABLE "${newTableName}" (\n`;
        const key1s = [...firstTableFieldsMap.keys()].join('", "');
        const key2s = [...secondTableFieldsMap.keys()].join('", "');

        // Columns
        firstTableFieldsMap.forEach((fieldType, fieldName) => {
          line += `  "${fieldName}" ${mapTypeToSQLite(fieldType)},\n`;
        });
        secondTableFieldsMap.forEach((fieldType, fieldName) => {
          line += `  "${fieldName}" ${mapTypeToSQLite(fieldType)},\n`;
        });

        // Composite PK
        line += `  PRIMARY KEY ("${key1s}", "${key2s}"),\n`;

        // FKs (inline)
        const refColsList = [...firstTableFieldsMap.keys()].map(k => `"${k}"`).join(', ');
        const forColsList = [...secondTableFieldsMap.keys()].map(k => `"${k}"`).join(', ');

        line += `  FOREIGN KEY (${refColsList}) REFERENCES "${refTable.name}" ${refCols}`;
        if (ref.onDelete) line += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
        if (ref.onUpdate) line += ` ON UPDATE ${ref.onUpdate.toUpperCase()}`;
        line += ',\n';

        line += `  FOREIGN KEY (${forColsList}) REFERENCES "${foreignTable.name}" ${foreignCols}`;
        if (ref.onDelete) line += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
        if (ref.onUpdate) line += ` ON UPDATE ${ref.onUpdate.toUpperCase()}`;
        line += '\n);\n';

        junctionCreates.push(line);
      } else {
        // 1:N: attach FK to the "many" side (foreignEndpoint.table)
        const fkClauseParts = [];
        fkClauseParts.push(`FOREIGN KEY ${foreignCols} REFERENCES "${refTable.name}" ${refCols}`);
        if (ref.onDelete) fkClauseParts.push(`ON DELETE ${ref.onDelete.toUpperCase()}`);
        if (ref.onUpdate) fkClauseParts.push(`ON UPDATE ${ref.onUpdate.toUpperCase()}`);

        const fkLine = fkClauseParts.join(' ');
        const tableId = foreignTable.id;
        if (!fksByTableId.has(tableId)) fksByTableId.set(tableId, []);
        fksByTableId.get(tableId).push(fkLine);
      }
    });

    return { fksByTableId, junctionCreates };
  }

  static buildFieldName (fieldIds, model) {
    const fieldNames = fieldIds.map(fieldId => `"${model.fields[fieldId].name}"`).join(', ');
    return `(${fieldNames})`;
  }

  static getFieldLines (tableId, model, enumMap) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];

      // Type & affinity
      let affinity;
      let isBoolean = false;
      let enumCheck = '';

      if (!field.type.schemaName || !shouldPrintSchemaName(field.type.schemaName)) {
        // Built-in or custom non-schema type string
        const originalTypeName = field.type.type_name;
        const upperType = normalizeTypeName(originalTypeName);

        // Enum detection (from enumMap): DBML enums appear as schema.type or type
        // Build potential keys to probe:
        const enumKeys = [
          `"${field.type.schemaName}"."${field.type.type_name}"`,
          `"${field.type.type_name}"`,
          field.type.type_name,
        ].filter(Boolean);

        let enumVals = null;
        enumKeys.some((k) => {
          if (enumMap.has(k)) {
            enumVals = enumMap.get(k);
            return true;
          }
          return false;
        });

        if (enumVals && enumVals.length) {
          affinity = 'TEXT';
          // CHECK uses the column name; applied after we build the base line
          enumCheck = ` CHECK ("${field.name}" IN (${enumVals.map(v => `'${v.replace(/'/g, "''")}'`).join(', ')}))`;
        } else {
          affinity = mapTypeToSQLite(originalTypeName);
          isBoolean = SQLITE_TYPE_MAP.bool.has(upperType);
        }
      } else {
        // A custom namespaced type → TEXT (conservative)
        affinity = 'TEXT';
      }

      // Start line with quoted identifier and affinity
      let line = `"${field.name}" ${affinity}`;

      // AUTOINCREMENT/PK handling:
      // In SQLite, AUTOINCREMENT only valid for a single-column INTEGER PRIMARY KEY.
      // If field.increment is set, prefer the canonical pattern.
      if (field.increment) {
        if (affinity === 'INTEGER') {
          // Make it the rowid PK. If user also marked pk, we’ll consume it here.
          line = `"${field.name}" INTEGER PRIMARY KEY AUTOINCREMENT`;
          // Note: do NOT add UNIQUE/NOT NULL/etc. here; SQLite implies NOT NULL for rowid PK.
        } else {
          // Non-integer increment requested → fallback to INTEGER (rowid) semantics not possible
          // Keep original affinity but ignore increment, as SQLite cannot autoincrement non-integer.
          // (Optionally: emit a comment)
          line += '';
        }
      } else {
        // Regular constraints
        if (field.unique) line += ' UNIQUE';
        // If PK on a non-increment column, allow either single or composite; for single, this will be a table-level or column-level PK.
        if (field.pk) {
          // Column-level PRIMARY KEY is valid (composite handled separately at table-level)
          line += ' PRIMARY KEY';
        }
        if (field.not_null) line += ' NOT NULL';
      }

      // Defaults
      if (field.dbdefault) {
        if (field.dbdefault.type === 'expression') {
          line += ` DEFAULT (${field.dbdefault.value})`;
        } else if (field.dbdefault.type === 'string') {
          line += ` DEFAULT '${field.dbdefault.value.replace(/'/g, "''")}'`;
        } else {
          line += ` DEFAULT ${field.dbdefault.value}`;
        }
      }

      // Boolean CHECK (optional): enforce 0/1 if desired.
      if (!field.increment && isBoolean) {
        line += ` CHECK ("${field.name}" IN (0,1))`;
      }

      // Enum CHECK
      if (enumCheck) {
        line += enumCheck;
      }

      return line;
    });

    return lines;
  }

  static getCompositePKs (tableId, model) {
    const table = model.tables[tableId];
    const compositePkIds = table.indexIds ? table.indexIds.filter(indexId => model.indexes[indexId].pk) : [];
    const lines = compositePkIds.map((keyId) => {
      const key = model.indexes[keyId];
      const columnArr = [];

      key.columnIds.forEach((columnId) => {
        const column = model.indexColumns[columnId];
        let columnStr = '';
        if (column.type === 'expression') {
          columnStr = `(${column.value})`;
        } else {
          columnStr = `"${column.value}"`;
        }
        columnArr.push(columnStr);
      });

      return `PRIMARY KEY (${columnArr.join(', ')})`;
    });
    return lines;
  }

  static exportTables (tableIds, model, enumMap, fksByTableId) {
    const tableStrs = (tableIds || []).map((tableId) => {
      const fieldContents = SqliteExporter.getFieldLines(tableId, model, enumMap);
      const compositePKs = SqliteExporter.getCompositePKs(tableId, model);
      const fkClauses = fksByTableId.get(tableId) || [];

      const content = [...fieldContents, ...compositePKs, ...fkClauses];

      const table = model.tables[tableId];
      // Ignore schemas in SQLite
      const tableStr = `CREATE TABLE "${table.name}" (\n${content.map(line => `  ${line}`).join(',\n')}\n);\n`;
      return tableStr;
    });

    return tableStrs;
  }

  static exportIndexes (indexIds, model) {
    // exclude composite pk index
    const indexArr = (indexIds || []).filter((indexId) => !model.indexes[indexId].pk).map((indexId) => {
      const index = model.indexes[indexId];
      const table = model.tables[index.tableId];

      let line = 'CREATE';
      if (index.unique) line += ' UNIQUE';
      const indexName = index.name ? `"${index.name}"` : '';
      line += ' INDEX';
      if (indexName) line += ` ${indexName}`;
      line += ` ON "${table.name}"`;

      // SQLite has no USING method
      const columnArr = [];
      index.columnIds.forEach((columnId) => {
        const column = model.indexColumns[columnId];
        let columnStr = '';
        if (column.type === 'expression') {
          columnStr = `(${column.value})`;
        } else {
          columnStr = `"${column.value}"`;
        }
        columnArr.push(columnStr);
      });

      line += ` (${columnArr.join(', ')})`;
      line += ';\n';
      return line;
    });

    return indexArr;
  }

  static exportComments (comments, model) {
    // SQLite does not support COMMENT ON; emit as SQL comments
    const commentArr = comments.map((comment) => {
      const table = model.tables[comment.tableId];
      switch (comment.type) {
        case 'table': {
          const txt = (table.note || '').replace(/'/g, "''");
          return `-- TABLE "${table.name}" COMMENT: '${txt}'\n`;
        }
        case 'column': {
          const field = model.fields[comment.fieldId];
          const txt = (field.note || '').replace(/'/g, "''");
          return `-- COLUMN "${table.name}"."${field.name}" COMMENT: '${txt}'\n`;
        }
        default:
          return '';
      }
    });
    return commentArr;
  }

  static export (model) {
    const database = model.database['1'];

    // Build enum map first
    const enumMap = SqliteExporter.buildEnumMap(model);

    // Collect all refs once to produce inline FKs and any junction tables
    const allRefIds = _.flatten(database.schemaIds.map(sid => model.schemas[sid].refIds || []));
    const { fksByTableId, junctionCreates } = SqliteExporter.collectForeignKeysByTable(allRefIds, model);

    const statements = database.schemaIds.reduce((prev, schemaId) => {
      const schema = model.schemas[schemaId];
      const { tableIds } = schema;

      if (!_.isEmpty(tableIds)) {
        prev.tables.push(...SqliteExporter.exportTables(tableIds, model, enumMap, fksByTableId));
      }

      const indexIds = _.flatten((tableIds || []).map((tableId) => model.tables[tableId].indexIds || []));
      if (!_.isEmpty(indexIds)) {
        prev.indexes.push(...SqliteExporter.exportIndexes(indexIds, model));
      }

      const commentNodes = _.flatten((tableIds || []).map((tableId) => {
        const { fieldIds, note } = model.tables[tableId];
        const fieldObjects = (fieldIds || [])
          .filter((fieldId) => model.fields[fieldId].note)
          .map((fieldId) => ({ type: 'column', fieldId, tableId }));
        return note ? [{ type: 'table', tableId }].concat(fieldObjects) : fieldObjects;
      }));
      if (!_.isEmpty(commentNodes)) {
        prev.comments.push(...SqliteExporter.exportComments(commentNodes, model));
      }

      return prev;
    }, {
      pragmas: [],
      tables: [],
      indexes: [],
      comments: [],
      junctions: [],
    });

    // Enable FK enforcement
    const pragmas = ['PRAGMA foreign_keys = ON;'];

    const res = _.concat(
      pragmas,
      // No schemas or enums in SQLite
      statements.tables,
      junctionCreates, // junction tables created after base tables (they only reference them)
      statements.indexes,
      statements.comments,
    ).join('\n');

    return res;
  }
}

export default SqliteExporter;
