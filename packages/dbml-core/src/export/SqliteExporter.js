import _ from 'lodash';
import {
  hasWhiteSpace,
  shouldPrintSchema,
  buildJunctionFields1,
  buildJunctionFields2,
  buildNewTableName,
} from './utils';
import { DEFAULT_SCHEMA_NAME } from '../model_structure/config';

class SQLiteExporter {
  static exportEnums (enumIds, model) {
    return [];
  }

  static getFieldLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];

      let line = '';
      if (field.increment) {
        line = `"${field.name}" INTEGER PRIMARY KEY AUTOINCREMENT`;
      } else {
        let typeName = field.type.type_name.toUpperCase();
        if (typeName === 'SERIAL') {
          typeName = 'INTEGER';
        } else if (typeName === 'VARCHAR') {
          typeName = 'TEXT';
        }
        line = `"${field.name}" ${typeName}`;
      }

      if (field.unique) {
        line += ' UNIQUE';
      }
      if (field.pk && !field.increment) {
        line += ' PRIMARY KEY';
      }
      if (field.not_null) {
        line += ' NOT NULL';
      }
      if (field.dbdefault) {
        if (field.dbdefault.type === 'expression') {
          if (field.dbdefault.value === 'now()') {
            line += ' DEFAULT CURRENT_TIMESTAMP';
          } else {
            line += ` DEFAULT (${field.dbdefault.value})`;
          }
        } else if (field.dbdefault.type === 'string') {
          line += ` DEFAULT '${field.dbdefault.value}'`;
        } else {
          line += ` DEFAULT ${field.dbdefault.value}`;
        }
      }

      return line;
    });

    return lines;
  }

  static getTableContentArr (tableIds, model) {
    const tableContentArr = tableIds.map((tableId) => {
      const fieldContents = SQLiteExporter.getFieldLines(tableId, model);

      return {
        tableId,
        fieldContents,
      };
    });

    return tableContentArr;
  }

  static exportTables (tableIds, model) {
    const tableContentArr = SQLiteExporter.getTableContentArr(tableIds, model);

    const tableStrs = tableContentArr.map((tableContent) => {
      const content = [...tableContent.fieldContents];
      const table = model.tables[tableContent.tableId];
      const tableStr = `CREATE TABLE "${table.name}" (\n${content.map(line => `  ${line}`).join(',\n')}\n);\n`;
      return tableStr;
    });

    return tableStrs;
  }

  static exportRefs (refIds, model, usedTableNames) {
    return [];
  }

  static exportIndexes (indexIds, model) {
    return [];
  }

  static exportComments (comments, model) {
    return [];
  }

  static export (model) {
    const database = model.database['1'];

    const usedTableNames = new Set(Object.values(model.tables).map(table => table.name));

    const statements = database.schemaIds.reduce((prevStatements, schemaId) => {
      const schema = model.schemas[schemaId];
      const { tableIds, enumIds, refIds } = schema;

      if (!_.isEmpty(tableIds)) {
        prevStatements.tables.push(...SQLiteExporter.exportTables(tableIds, model));
      }

      return prevStatements;
    }, {
      tables: [],
    });

    const res = _.concat(
      statements.tables,
      statements.indexes,
    ).join('\n');
    return res;
  }
}

export default SQLiteExporter;
