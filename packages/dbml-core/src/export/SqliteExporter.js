/* eslint-disable max-len */
import _ from 'lodash';
import {
  buildJunctionFields1,
  buildJunctionFields2,
  buildNewTableName,
} from './utils';
import { shouldPrintSchemaName } from '../model_structure/utils';

function escapeSingleQuotes(s) {
  return String(s || '').replace(/'/g, "''");
}

// Minimal boolean type detection - only used to add CHECK (field IN (0,1)) constraints
// for fields that should be boolean in nature
const BOOLEAN_TYPES = new Set(['BOOLEAN', 'BOOL']);

function isBooleanType(typeName) {
  const normalized = (typeName || '').trim().toUpperCase();
  return BOOLEAN_TYPES.has(normalized);
}

function topoSortTables(allTableIds, dependencyEdges) {
  const parentsByChild = new Map();
  const childrenByParent = new Map();
  const indegree = new Map();

  allTableIds.forEach(id => {
    indegree.set(id, 0);
    parentsByChild.set(id, new Set());
    childrenByParent.set(id, new Set());
  });

  (dependencyEdges || []).forEach(([child, parent]) => {
    if (!parentsByChild.has(child)) parentsByChild.set(child, new Set());
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, new Set());
    if (!parentsByChild.get(child).has(parent)) {
      parentsByChild.get(child).add(parent);
      childrenByParent.get(parent).add(child);
      indegree.set(child, (indegree.get(child) || 0) + 1);
    }
  });

  const q = [];
  indegree.forEach((deg, id) => { if (deg === 0) q.push(id); });

  const ordered = [];
  while (q.length) {
    const node = q.shift();
    ordered.push(node);
    (childrenByParent.get(node) || []).forEach(child => {
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) q.push(child);
    });
  }

  if (ordered.length !== allTableIds.length) {
    return allTableIds;
  }
  return ordered;
}


class SqliteExporter {
  static buildEnumMap(model) {
    const map = new Map();
    Object.keys(model.enums).forEach((enumId) => {
      const e = model.enums[enumId];
      const schema = model.schemas[e.schemaId];
      const fq = `"${schema.name}"."${e.name}"`;
      const local = `"${e.name}"`;
      const vals = e.valueIds.map(id => model.enumValues[id].name);
      map.set(fq, vals);
      map.set(local, vals);
      map.set(e.name, vals);
    });
    return map;
  }

  // Collect per-table FK clauses (since SQLite needs inline FKs)
  static collectForeignKeysByTable(refIds, model) {
    const fksByTableId = new Map();
    const junctionCreates = [];
    const dependencyEdges = [];

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

      const refCols = SqliteExporter.buildFieldName(refEndpoint.fieldIds, model);
      const foreignCols = SqliteExporter.buildFieldName(foreignEndpoint.fieldIds, model);

      if (refOneIndex === -1) {
        const firstTableFieldsMap = buildJunctionFields1(refEndpoint.fieldIds, model);
        const secondTableFieldsMap = buildJunctionFields2(foreignEndpoint.fieldIds, model, firstTableFieldsMap);
        const newTableName = buildNewTableName(refTable.name, foreignTable.name, usedTableNames);

        let line = `CREATE TABLE "${newTableName}" (\n`;
        const key1s = [...firstTableFieldsMap.keys()].join('","');
        const key2s = [...secondTableFieldsMap.keys()].join('","');

        firstTableFieldsMap.forEach((fieldType, fieldName) => {
          line += `  "${fieldName}" ${fieldType},\n`;
        });
        secondTableFieldsMap.forEach((fieldType, fieldName) => {
          line += `  "${fieldName}" ${fieldType},\n`;
        });

        line += `  PRIMARY KEY ("${key1s}","${key2s}"),\n`;

        const refColsList = [...firstTableFieldsMap.keys()].map(k => `"${k}"`).join(',');
        const forColsList = [...secondTableFieldsMap.keys()].map(k => `"${k}"`).join(',');

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
        const fkClauseParts = [];
        fkClauseParts.push(`FOREIGN KEY ${foreignCols} REFERENCES "${refTable.name}" ${refCols}`);
        if (ref.onDelete) fkClauseParts.push(`ON DELETE ${ref.onDelete.toUpperCase()}`);
        if (ref.onUpdate) fkClauseParts.push(`ON UPDATE ${ref.onUpdate.toUpperCase()}`);

        const fkLine = fkClauseParts.join(' ');
        const tableId = foreignTable.id;
        if (!fksByTableId.has(tableId)) fksByTableId.set(tableId, []);
        fksByTableId.get(tableId).push(fkLine);
        dependencyEdges.push([foreignTable.id, refTable.id]);
      }
    });

    return { fksByTableId, junctionCreates, dependencyEdges };
  }

  static buildFieldName(fieldIds, model) {
    const fieldNames = fieldIds.map(fieldId => `"${model.fields[fieldId].name}"`).join(',');
    return `(${fieldNames})`;
  }

  static getFieldLines(tableId, model, enumMap) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];

      let typeName;
      let isBoolean = false;
      let enumCheck = '';

      if (!field.type.schemaName || !shouldPrintSchemaName(field.type.schemaName)) {
        const originalTypeName = field.type.type_name;

        const enumKeys = [
          `"${field.type.schemaName}"."${field.type.type_name}"`,
          `"${field.type.type_name}"`,
          field.type.type_name,
        ].filter(Boolean);

        let enumVals = null;
        for (const k of enumKeys) {
          if (enumMap.has(k)) { enumVals = enumMap.get(k); break; }
        }

        if (enumVals && enumVals.length) {
          typeName = 'TEXT';
          enumCheck = ` CHECK ("${field.name}" IN (${enumVals.map(v => `'${escapeSingleQuotes(v)}'`).join(',')}))`;
        } else {
          typeName = originalTypeName;
          isBoolean = isBooleanType(originalTypeName);
        }
      } else {
        typeName = 'TEXT';
      }

      let line = `"${field.name}" ${typeName}`;

      if (field.increment) {
        if (typeName.toUpperCase().includes('INT')) {
          line = `"${field.name}" INTEGER PRIMARY KEY AUTOINCREMENT`;
        }
      } else {
        if (field.unique) line += ' UNIQUE';
        if (field.pk) line += ' PRIMARY KEY';
        if (field.not_null) line += ' NOT NULL';
      }

      if (field.dbdefault) {
        if (field.dbdefault.type === 'expression') {
          let expr = String(field.dbdefault.value || '').trim();
          line += ` DEFAULT (${expr})`;
        } else if (field.dbdefault.type === 'string') {
          line += ` DEFAULT '${escapeSingleQuotes(field.dbdefault.value)}'`;
        } else {
          line += ` DEFAULT ${field.dbdefault.value}`;
        }
      }

      if (!field.increment && isBoolean) {
        line += ` CHECK ("${field.name}" IN (0,1))`;
      }
      if (enumCheck) line += enumCheck;

      return line;
    });

    return lines;
  }

  static getCompositePKs(tableId, model) {
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

      return `PRIMARY KEY (${columnArr.join(',')})`;
    });
    return lines;
  }

  static exportTables(tableIds, model, enumMap, fksByTableId) {
    const tableStrs = (tableIds || []).map((tableId) => {
      const table = model.tables[tableId];

      const fieldContents = SqliteExporter.getFieldLines(tableId, model, enumMap);
      const compositePKs = SqliteExporter.getCompositePKs(tableId, model);
      const fkClauses = fksByTableId.get(tableId) || [];

      const content = [...fieldContents, ...compositePKs, ...fkClauses];

      const tableStr =
        `CREATE TABLE "${table.name}" (\n` +
        `${content.map(line => `  ${line}`).join(',\n')}\n` +
        `);\n`;

      return tableStr;
    });

    return tableStrs;
  }

  static exportIndexes(indexIds, model) {
    const indexArr = (indexIds || []).filter((indexId) => !model.indexes[indexId].pk).map((indexId) => {
      const index = model.indexes[indexId];
      const table = model.tables[index.tableId];

      let line = 'CREATE';
      if (index.unique) line += ' UNIQUE';
      const indexName = index.name ? `"${index.name}"` : '';
      line += ' INDEX';
      if (indexName) line += ` ${indexName}`;
      line += ` ON "${table.name}"`;

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

      line += ` (${columnArr.join(',')})`;
      line += ';\n';
      return line;
    });

    return indexArr;
  }

  static export(model) {
    const database = model.database['1'];

    const enumMap = SqliteExporter.buildEnumMap(model);

    const allRefIds = _.flatten(database.schemaIds.map(sid => model.schemas[sid].refIds || []));
    const { fksByTableId, junctionCreates, dependencyEdges } = SqliteExporter.collectForeignKeysByTable(allRefIds, model);

    const allTableIds = _.flatten(database.schemaIds.map(sid => model.schemas[sid].tableIds || []));
    const orderedTableIds = topoSortTables(allTableIds, dependencyEdges);

    const tableCreates = SqliteExporter.exportTables(orderedTableIds, model, enumMap, fksByTableId);

    const allIndexIds = _.flatten(
      (database.schemaIds || []).map(sid => {
        const tIds = model.schemas[sid].tableIds || [];
        return _.flatten(tIds.map(tid => model.tables[tid].indexIds || []));
      })
    );
    const indexCreates = SqliteExporter.exportIndexes(allIndexIds, model);

    const pragmas = ['PRAGMA foreign_keys = ON;\n'];

    const res = _.concat(
      pragmas,
      tableCreates,
      junctionCreates,
      indexCreates,
    ).join('\n');

    return res;
  }
}

export default SqliteExporter;