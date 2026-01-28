import { concat, flatten, isEmpty } from 'lodash-es';
import {
  shouldPrintSchema,
  buildJunctionFields1,
  buildJunctionFields2,
  buildNewTableName,
} from './utils';
import {
  isNumericType,
  isStringType,
  isBooleanType,
  isDateTimeType,
  isBinaryType,
} from '@dbml/parse';

class SqlServerExporter {
  static exportRecords (model) {
    const records = Object.values(model.records || {});
    if (_.isEmpty(records)) {
      return [];
    }

    const insertStatements = records.map((record) => {
      const { schemaName, tableName, columns, values } = record;

      // Build the table reference with schema if present
      const tableRef = schemaName ? `[${schemaName}].[${tableName}]` : `[${tableName}]`;

      // Build the column list
      const columnList = columns.length > 0
        ? `([${columns.join('], [')}])`
        : '';

      // Value formatter for SQL Server
      const formatValue = (val) => {
        if (val.value === null) return 'NULL';
        if (val.type === 'expression') return val.value;

        if (isNumericType(val.type)) return val.value;
        if (isBooleanType(val.type)) return val.value.toString() ? '1' : '0';
        if (isStringType(val.type) || isDateTimeType(val.type)) return `'${val.value.replace(/'/g, "''")}'`;
        if (isBinaryType(val.type)) return `0x${val.value}`; // SQL Server binary as hex
        // Unknown type - use CAST
        return `CAST('${val.value.replace(/'/g, "''")}' AS ${val.type})`;
      };

      // Build the VALUES clause
      const valueRows = values.map((row) => {
        const valueStrs = row.map(formatValue);
        return `(${valueStrs.join(', ')})`;
      });

      const valuesClause = valueRows.join(',\n  ');

      return `INSERT INTO ${tableRef} ${columnList}\nVALUES\n  ${valuesClause};\nGO`;
    });

    return insertStatements;
  }

  static getFieldLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];
      let line = '';

      if (field.enumId) {
        const _enum = model.enums[field.enumId];
        line = `[${field.name}] nvarchar(255) NOT NULL CHECK ([${field.name}] IN (`;
        const enumValues = _enum.valueIds.map((valueId) => {
          const value = model.enumValues[valueId];
          return `'${value.name}'`;
        });
        line += `${enumValues.join(', ')}))`;
      } else {
        line = `[${field.name}] ${field.type.type_name !== 'varchar' ? field.type.type_name : 'nvarchar(255)'}`;
      }

      if (field.unique) {
        line += ' UNIQUE';
      }
      if (field.pk) {
        line += ' PRIMARY KEY';
      }
      if (field.not_null) {
        line += ' NOT NULL';
      }
      if (field.increment) {
        line += ' IDENTITY(1, 1)';
      }
      if (field.checkIds && field.checkIds.length > 0) {
        if (field.checkIds.length === 1) {
          const check = model.checks[field.checkIds[0]];
          if (check.name) {
            line += ` CONSTRAINT [${check.name}]`;
          }
          line += ` CHECK (${check.expression})`;
        } else {
          const checkExpressions = field.checkIds.map((checkId) => {
            const check = model.checks[checkId];
            return `(${check.expression})`;
          });
          line += ` CHECK (${checkExpressions.join(' AND ')})`;
        }
      }
      if (field.dbdefault) {
        if (field.dbdefault.type === 'expression') {
          line += ` DEFAULT (${field.dbdefault.value})`;
        } else if (field.dbdefault.type === 'string') {
          line += ` DEFAULT '${field.dbdefault.value}'`;
        } else {
          line += ` DEFAULT (${field.dbdefault.value})`;
        }
      }
      return line;
    });

    return lines;
  }

  static getCompositePKs (tableId, model) {
    const table = model.tables[tableId];

    const compositePkIds = table.indexIds ? table.indexIds.filter((indexId) => model.indexes[indexId].pk) : [];
    const lines = compositePkIds.map((keyId) => {
      const key = model.indexes[keyId];
      let line = 'PRIMARY KEY';
      const columnArr = [];

      key.columnIds.forEach((columnId) => {
        const column = model.indexColumns[columnId];
        let columnStr = '';
        if (column.type === 'expression') {
          columnStr = `(${column.value})`;
        } else {
          columnStr = `[${column.value}]`;
        }
        columnArr.push(columnStr);
      });

      line += ` (${columnArr.join(', ')})`;

      return line;
    });

    return lines;
  }

  static getCheckLines (tableId, model) {
    const table = model.tables[tableId];

    if (!table.checkIds || table.checkIds.length === 0) {
      return [];
    }

    const lines = table.checkIds.map((checkId) => {
      const check = model.checks[checkId];
      let line = '';

      if (check.name) {
        line = `CONSTRAINT [${check.name}] `;
      }

      line += `CHECK (${check.expression})`;

      return line;
    });

    return lines;
  }

  static getTableContentArr (tableIds, model) {
    const tableContentArr = tableIds.map((tableId) => {
      const fieldContents = SqlServerExporter.getFieldLines(tableId, model);
      const checkContents = SqlServerExporter.getCheckLines(tableId, model);
      const compositePKs = SqlServerExporter.getCompositePKs(tableId, model);

      return {
        tableId,
        fieldContents,
        checkContents,
        compositePKs,
      };
    });

    return tableContentArr;
  }

  static exportTables (tableIds, model) {
    const tableContentArr = SqlServerExporter.getTableContentArr(tableIds, model);

    const tableStrs = tableContentArr.map((tableContent) => {
      const content = [...tableContent.fieldContents, ...tableContent.checkContents, ...tableContent.compositePKs];
      const table = model.tables[tableContent.tableId];
      const schema = model.schemas[table.schemaId];
      const tableStr = `CREATE TABLE ${shouldPrintSchema(schema, model)
        ? `[${schema.name}].`
        : ''}[${table.name}] (\n${
        content.map((line) => `  ${line}`).join(',\n')}\n)\nGO\n`;
      return tableStr;
    });

    return tableStrs;
  }

  static buildTableManyToMany (firstTableFieldsMap, secondTableFieldsMap, tableName, refEndpointSchema, model) {
    let line = `CREATE TABLE ${shouldPrintSchema(refEndpointSchema, model)
      ? `[${refEndpointSchema.name}].`
      : ''}[${tableName}] (\n`;
    const key1s = [...firstTableFieldsMap.keys()].join('], [');
    const key2s = [...secondTableFieldsMap.keys()].join('], [');
    firstTableFieldsMap.forEach((fieldType, fieldName) => {
      line += `  [${fieldName}] ${fieldType},\n`;
    });
    secondTableFieldsMap.forEach((fieldType, fieldName) => {
      line += `  [${fieldName}] ${fieldType},\n`;
    });
    line += `  PRIMARY KEY ([${key1s}], [${key2s}])\n`;
    line += ');\nGO\n\n';
    return line;
  }

  static buildForeignKeyManyToMany (fieldsMap, foreignEndpointFields, refEndpointTableName, foreignEndpointTableName, refEndpointSchema, foreignEndpointSchema, model) {
    const refEndpointFields = [...fieldsMap.keys()].join('], [');
    const line = `ALTER TABLE ${shouldPrintSchema(refEndpointSchema, model)
      ? `[${refEndpointSchema.name}].`
      : ''}[${refEndpointTableName}] ADD FOREIGN KEY ([${refEndpointFields}]) REFERENCES ${shouldPrintSchema(foreignEndpointSchema, model)
      ? `[${foreignEndpointSchema.name}].`
      : ''}[${foreignEndpointTableName}] ${foreignEndpointFields};\nGO\n\n`;
    return line;
  }

  static buildFieldName (fieldIds, model) {
    const fieldNames = fieldIds.map((fieldId) => `[${model.fields[fieldId].name}]`).join(', ');
    return `(${fieldNames})`;
  }

  static exportRefs (refIds, model, usedTableNames) {
    const strArr = refIds.map((refId) => {
      let line = '';
      const ref = model.refs[refId];
      const refOneIndex = ref.endpointIds.findIndex((endpointId) => model.endpoints[endpointId].relation === '1');
      const refEndpointIndex = refOneIndex === -1 ? 0 : refOneIndex;
      const foreignEndpointId = ref.endpointIds[1 - refEndpointIndex];
      const refEndpointId = ref.endpointIds[refEndpointIndex];
      const foreignEndpoint = model.endpoints[foreignEndpointId];
      const refEndpoint = model.endpoints[refEndpointId];

      const refEndpointField = model.fields[refEndpoint.fieldIds[0]];
      const refEndpointTable = model.tables[refEndpointField.tableId];
      const refEndpointSchema = model.schemas[refEndpointTable.schemaId];
      const refEndpointFieldName = this.buildFieldName(refEndpoint.fieldIds, model, 'mssql');

      const foreignEndpointField = model.fields[foreignEndpoint.fieldIds[0]];
      const foreignEndpointTable = model.tables[foreignEndpointField.tableId];
      const foreignEndpointSchema = model.schemas[foreignEndpointTable.schemaId];
      const foreignEndpointFieldName = this.buildFieldName(foreignEndpoint.fieldIds, model, 'mssql');

      if (refOneIndex === -1) { // many to many relationship
        const firstTableFieldsMap = buildJunctionFields1(refEndpoint.fieldIds, model);
        const secondTableFieldsMap = buildJunctionFields2(foreignEndpoint.fieldIds, model, firstTableFieldsMap);

        const newTableName = buildNewTableName(refEndpointTable.name, foreignEndpointTable.name, usedTableNames);
        line += this.buildTableManyToMany(firstTableFieldsMap, secondTableFieldsMap, newTableName, refEndpointSchema, model);

        line += this.buildForeignKeyManyToMany(firstTableFieldsMap, refEndpointFieldName, newTableName, refEndpointTable.name, refEndpointSchema, refEndpointSchema, model);
        line += this.buildForeignKeyManyToMany(secondTableFieldsMap, foreignEndpointFieldName, newTableName, foreignEndpointTable.name, refEndpointSchema, foreignEndpointSchema, model);
      } else {
        line = `ALTER TABLE ${shouldPrintSchema(foreignEndpointSchema, model)
          ? `[${foreignEndpointSchema.name}].`
          : ''}[${foreignEndpointTable.name}] ADD `;

        if (ref.name) {
          line += `CONSTRAINT [${ref.name}] `;
        }

        line += `FOREIGN KEY ${foreignEndpointFieldName} REFERENCES ${shouldPrintSchema(refEndpointSchema, model)
          ? `[${refEndpointSchema.name}].`
          : ''}[${refEndpointTable.name}] ${refEndpointFieldName}`;
        if (ref.onDelete) {
          line += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
        }
        if (ref.onUpdate) {
          line += ` ON UPDATE ${ref.onUpdate.toUpperCase()}`;
        }
        line += '\nGO\n';
      }
      return line;
    });

    return strArr;
  }

  static exportIndexes (indexIds, model) {
    // exclude composite pk index
    const indexArr = indexIds.filter((indexId) => !model.indexes[indexId].pk).map((indexId, i) => {
      const index = model.indexes[indexId];
      const table = model.tables[index.tableId];
      const schema = model.schemas[table.schemaId];

      let line = 'CREATE';
      if (index.unique) {
        line += ' UNIQUE';
      }
      const indexName = index.name
        ? `[${index.name}]`
        : `${shouldPrintSchema(schema, model)
          ? `[${schema.name}].`
          : ''}[${table.name}_index_${i}]`;
      line += ` INDEX ${indexName} ON ${shouldPrintSchema(schema, model)
        ? `[${schema.name}].`
        : ''}[${table.name}]`;

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
      line += '\nGO\n';

      return line;
    });

    return indexArr;
  }

  static exportComments (comments, model) {
    const commentArr = comments.map((comment) => {
      const table = model.tables[comment.tableId];
      const schema = model.schemas[table.schemaId];
      let line = '';
      line = 'EXEC sp_addextendedproperty\n';

      switch (comment.type) {
        case 'table': {
          line += '@name = N\'Table_Description\',\n';
          line += `@value = '${table.note.replace(/'/g, '\'\'')}',\n`;
          line += `@level0type = N'Schema', @level0name = '${shouldPrintSchema(schema, model) ? `${schema.name}` : 'dbo'}',\n`;
          line += `@level1type = N'Table',  @level1name = '${table.name}';\n`;
          break;
        }
        case 'column': {
          const field = model.fields[comment.fieldId];
          line += '@name = N\'Column_Description\',\n';
          line += `@value = '${field.note.replace(/'/g, '\'\'')}',\n`;
          line += `@level0type = N'Schema', @level0name = '${shouldPrintSchema(schema, model) ? `${schema.name}` : 'dbo'}',\n`;
          line += `@level1type = N'Table',  @level1name = '${table.name}',\n`;
          line += `@level2type = N'Column', @level2name = '${field.name}';\n`;
          break;
        }
        default:
          break;
      }

      line += 'GO\n';

      return line;
    });

    return commentArr;
  }

  static export (model) {
    const database = model.database['1'];

    const usedTableNames = new Set(Object.values(model.tables).map((table) => table.name));

    const statements = database.schemaIds.reduce((prevStatements, schemaId) => {
      const schema = model.schemas[schemaId];
      const { tableIds, refIds } = schema;

      if (shouldPrintSchema(schema, model)) {
        prevStatements.schemas.push(`CREATE SCHEMA [${schema.name}]\nGO\n`);
      }

      if (!isEmpty(tableIds)) {
        prevStatements.tables.push(...SqlServerExporter.exportTables(tableIds, model));
      }

      const indexIds = flatten(tableIds.map((tableId) => model.tables[tableId].indexIds));
      if (!isEmpty(indexIds)) {
        prevStatements.indexes.push(...SqlServerExporter.exportIndexes(indexIds, model));
      }

      const commentNodes = flatten(tableIds.map((tableId) => {
        const { fieldIds, note } = model.tables[tableId];
        const fieldObjects = fieldIds
          .filter((fieldId) => model.fields[fieldId].note)
          .map((fieldId) => ({ type: 'column', fieldId, tableId }));
        return note ? [{ type: 'table', tableId }].concat(fieldObjects) : fieldObjects;
      }));
      if (!isEmpty(commentNodes)) {
        prevStatements.comments.push(...SqlServerExporter.exportComments(commentNodes, model));
      }

      if (!isEmpty(refIds)) {
        prevStatements.refs.push(...SqlServerExporter.exportRefs(refIds, model, usedTableNames));
      }

      return prevStatements;
    }, {
      schemas: [],
      enums: [],
      tables: [],
      indexes: [],
      comments: [],
      refs: [],
    });

    // Export INSERT statements
    // Note: SQL Server does not support DEFERRED constraints, so constraint checks are disabled
    const insertStatements = SqlServerExporter.exportRecords(model);
    const recordsSection = !isEmpty(insertStatements)
      ? [
          '-- Disable constraint checks for INSERT',
          'EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";',
          'GO',
          '',
          ...insertStatements,
          '',
          '-- Re-enable constraint checks',
          'EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all";',
          'GO',
        ]
      : [];

    const res = concat(
      statements.schemas,
      statements.enums,
      statements.tables,
      statements.indexes,
      statements.comments,
      statements.refs,
      recordsSection,
    ).join('\n');
    return res;
  }
}

export default SqlServerExporter;
