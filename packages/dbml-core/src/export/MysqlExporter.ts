import { concat, flatten, isEmpty } from 'lodash-es';
import {
  shouldPrintSchema,
  buildJunctionFields1,
  buildJunctionFields2,
  buildNewTableName,
  CommentNode,
} from './utils';
import {
  isNumericType,
  isStringType,
  isBooleanType,
  isDateTimeType,
  isBinaryType,
} from '@dbml/parse';
import { NormalizedModel, RecordValue } from '../model_structure/database';

class MySQLExporter {
  static exportRecords (model: NormalizedModel): string[] {
    const records = Object.values(model.records || {});
    if (isEmpty(records)) {
      return [];
    }

    const insertStatements = records.map((record) => {
      const { schemaName, tableName, columns, values } = record;

      // Build the table reference with schema if present
      const tableRef = schemaName ? `\`${schemaName}\`.\`${tableName}\`` : `\`${tableName}\``;

      // Build the column list
      const columnList = columns.length > 0
        ? `(\`${columns.join('`, `')}\`)`
        : '';

      // Value formatter for MySQL
      const formatValue = (val: RecordValue): string => {
        if (val.value === null) return 'NULL';
        if (val.type === 'expression') return val.value;

        if (isNumericType(val.type)) return val.value;
        if (isBooleanType(val.type)) return String(val.value).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE';
        if (isStringType(val.type) || isBinaryType(val.type) || isDateTimeType(val.type)) return `'${val.value.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
        // Unknown type - use CAST
        return `CAST('${val.value.replace(/'/g, "''").replace(/\\/g, '\\\\')}' AS ${val.type})`;
      };

      // Build the VALUES clause
      const valueRows = values.map((row: RecordValue[]) => {
        const valueStrs = row.map(formatValue);
        return `(${valueStrs.join(', ')})`;
      });

      const valuesClause = valueRows.join(',\n  ');

      return `INSERT INTO ${tableRef} ${columnList}\nVALUES\n  ${valuesClause};`;
    });

    return insertStatements;
  }

  static getFieldLines (tableId: number, model: NormalizedModel): string[] {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];
      let line = '';

      if (field.enumId) {
        const _enum = model.enums[field.enumId];
        line = `\`${field.name}\` ENUM (`;
        const enumValues = _enum.valueIds.map((valueId) => {
          return `'${model.enumValues[valueId].name}'`;
        });
        line += `${enumValues.join(', ')})`;
      } else {
        line = `\`${field.name}\` ${field.type.type_name !== 'varchar' ? field.type.type_name : 'varchar(255)'}`;
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
        line += ' AUTO_INCREMENT';
      }
      if (field.checkIds && field.checkIds.length > 0) {
        if (field.checkIds.length === 1) {
          const check = model.checks[field.checkIds[0]];
          if (check.name) {
            line += ` CONSTRAINT \`${check.name}\``;
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
        // Skip DEFAULT NULL as it's redundant (columns are nullable by default)
        const isNullDefault = field.dbdefault.type === 'boolean' && (
          field.dbdefault.value === null
          || (typeof field.dbdefault.value === 'string' && field.dbdefault.value.toLowerCase() === 'null')
        );

        if (!isNullDefault) {
          if (field.dbdefault.type === 'expression') {
            line += ` DEFAULT (${field.dbdefault.value})`;
          } else if (field.dbdefault.type === 'string') {
            line += ` DEFAULT '${field.dbdefault.value}'`;
          } else {
            line += ` DEFAULT ${field.dbdefault.value}`;
          }
        }
      }
      if (field.note) {
        line += ` COMMENT '${field.note.replace(/'/g, '\'\'')}'`;
      }

      return line;
    });

    return lines;
  }

  static getCompositePKs (tableId: number, model: NormalizedModel): string[] {
    const table = model.tables[tableId];

    const compositePkIds = table.indexIds ? table.indexIds.filter((indexId) => model.indexes[indexId].pk) : [];
    const lines = compositePkIds.map((keyId) => {
      const key = model.indexes[keyId];
      let line = 'PRIMARY KEY';
      const columnArr: string[] = [];

      key.columnIds.forEach((columnId) => {
        const column = model.indexColumns[columnId];
        let columnStr = '';
        if (column.type === 'expression') {
          columnStr = `(${column.value})`;
        } else {
          columnStr = `\`${column.value}\``;
        }
        columnArr.push(columnStr);
      });

      line += ` (${columnArr.join(', ')})`;

      return line;
    });

    return lines;
  }

  static getCheckLines (tableId: number, model: NormalizedModel): string[] {
    const table = model.tables[tableId];

    if (!table.checkIds || table.checkIds.length === 0) {
      return [];
    }

    const lines = table.checkIds.map((checkId) => {
      const check = model.checks[checkId];
      let line = '';

      if (check.name) {
        line = `CONSTRAINT \`${check.name}\` `;
      }

      line += `CHECK (${check.expression})`;

      return line;
    });

    return lines;
  }

  static getTableContentArr (tableIds: number[], model: NormalizedModel): Array<{
    tableId: number;
    fieldContents: string[];
    checkContents: string[];
    compositePKs: string[];
  }> {
    const tableContentArr = tableIds.map((tableId) => {
      const fieldContents = MySQLExporter.getFieldLines(tableId, model);
      const checkContents = MySQLExporter.getCheckLines(tableId, model);
      const compositePKs = MySQLExporter.getCompositePKs(tableId, model);

      return {
        tableId,
        fieldContents,
        checkContents,
        compositePKs,
      };
    });

    return tableContentArr;
  }

  static exportTables (tableIds: number[], model: NormalizedModel): string[] {
    const tableContentArr = MySQLExporter.getTableContentArr(tableIds, model);

    const tableStrs = tableContentArr.map((tableContent) => {
      const content = [...tableContent.fieldContents, ...tableContent.checkContents, ...tableContent.compositePKs];
      const table = model.tables[tableContent.tableId];
      const schema = model.schemas[table.schemaId];
      const tableStr = `CREATE TABLE ${shouldPrintSchema(schema, model)
        ? `\`${schema.name}\`.`
        : ''}\`${table.name}\` (\n${
        content.map((line) => `  ${line}`).join(',\n')}\n);\n`;
      return tableStr;
    });

    return tableStrs;
  }

  static buildFieldName (fieldIds: number[], model: NormalizedModel): string {
    const fieldNames = fieldIds.map((fieldId) => `\`${model.fields[fieldId].name}\``).join(', ');
    return `(${fieldNames})`;
  }

  static buildTableManyToMany (firstTableFieldsMap: Map<string, string>, secondTableFieldsMap: Map<string, string>, tableName: string, refEndpointSchema: any, model: NormalizedModel): string {
    let line = `CREATE TABLE ${shouldPrintSchema(refEndpointSchema, model) ? `\`${refEndpointSchema.name}\`.` : ''}\`${tableName}\` (\n`;
    const key1s = [...firstTableFieldsMap.keys()].join('`, `');
    const key2s = [...secondTableFieldsMap.keys()].join('`, `');
    firstTableFieldsMap.forEach((fieldType, fieldName) => {
      line += `  \`${fieldName}\` ${fieldType},\n`;
    });
    secondTableFieldsMap.forEach((fieldType, fieldName) => {
      line += `  \`${fieldName}\` ${fieldType},\n`;
    });
    line += `  PRIMARY KEY (\`${key1s}\`, \`${key2s}\`)\n`;
    line += ');\n\n';
    return line;
  }

  static buildForeignKeyManyToMany (
    fieldsMap: Map<string, string>,
    foreignEndpointFields: string,
    refEndpointTableName: string,
    foreignEndpointTableName: string,
    refEndpointSchema: any,
    foreignEndpointSchema: any,
    model: NormalizedModel,
  ): string {
    const refEndpointFields = [...fieldsMap.keys()].join('`, `');
    const line = `ALTER TABLE ${shouldPrintSchema(refEndpointSchema, model)
      ? `\`${refEndpointSchema.name}\`.`
      : ''}\`${refEndpointTableName}\` ADD FOREIGN KEY (\`${refEndpointFields}\`) REFERENCES ${shouldPrintSchema(foreignEndpointSchema, model)
      ? `\`${foreignEndpointSchema.name}\`.`
      : ''}\`${foreignEndpointTableName}\` ${foreignEndpointFields};\n\n`;
    return line;
  }

  static exportRefs (
    refIds: number[],
    model: NormalizedModel,
    usedTableNames: Set<string>,
  ): string[] {
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
      const refEndpointFieldName = this.buildFieldName(refEndpoint.fieldIds, model);

      const foreignEndpointField = model.fields[foreignEndpoint.fieldIds[0]];
      const foreignEndpointTable = model.tables[foreignEndpointField.tableId];
      const foreignEndpointSchema = model.schemas[foreignEndpointTable.schemaId];
      const foreignEndpointFieldName = this.buildFieldName(foreignEndpoint.fieldIds, model);

      if (refOneIndex === -1) {
        const firstTableFieldsMap = buildJunctionFields1(refEndpoint.fieldIds, model);
        const secondTableFieldsMap = buildJunctionFields2(foreignEndpoint.fieldIds, model, firstTableFieldsMap);

        const newTableName = buildNewTableName(refEndpointTable.name, foreignEndpointTable.name, usedTableNames);
        line += this.buildTableManyToMany(firstTableFieldsMap, secondTableFieldsMap, newTableName, refEndpointSchema, model);

        line += this.buildForeignKeyManyToMany(firstTableFieldsMap, refEndpointFieldName, newTableName, refEndpointTable.name, refEndpointSchema, refEndpointSchema, model);
        line += this.buildForeignKeyManyToMany(secondTableFieldsMap, foreignEndpointFieldName, newTableName, foreignEndpointTable.name, refEndpointSchema, foreignEndpointSchema, model);
      } else {
        line = `ALTER TABLE ${shouldPrintSchema(foreignEndpointSchema, model)
          ? `\`${foreignEndpointSchema.name}\`.`
          : ''}\`${foreignEndpointTable.name}\` ADD `;
        if (ref.name) {
          line += `CONSTRAINT \`${ref.name}\` `;
        }
        line += `FOREIGN KEY ${foreignEndpointFieldName} REFERENCES ${shouldPrintSchema(refEndpointSchema, model)
          ? `\`${refEndpointSchema.name}\`.`
          : ''}\`${refEndpointTable.name}\` ${refEndpointFieldName}`;
        if (ref.onDelete) {
          line += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
        }
        if (ref.onUpdate) {
          line += ` ON UPDATE ${ref.onUpdate.toUpperCase()}`;
        }
        line += ';\n';
      }
      return line;
    });

    return strArr;
  }

  static exportIndexes (
    indexIds: number[],
    model: NormalizedModel,
  ): string[] {
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
        ? `\`${index.name}\``
        : `\`${shouldPrintSchema(schema, model)
          ? `\`${schema.name}\`.`
          : ''}${table.name}_index_${i}\``;
      line += ` INDEX ${indexName} ON ${shouldPrintSchema(schema, model)
        ? `\`${schema.name}\`.`
        : ''}\`${table.name}\``;

      const columnArr: string[] = [];
      index.columnIds.forEach((columnId) => {
        const column = model.indexColumns[columnId];
        let columnStr = '';
        if (column.type === 'expression') {
          columnStr = `(${column.value})`;
        } else {
          columnStr = `\`${column.value}\``;
        }
        columnArr.push(columnStr);
      });

      line += ` (${columnArr.join(', ')})`;
      if (index.type) {
        line += ` USING ${index.type.toUpperCase()}`;
      }
      line += ';\n';

      return line;
    });

    return indexArr;
  }

  static exportComments (
    comments: CommentNode[],
    model: NormalizedModel,
  ): string[] {
    const commentArr = comments.map((comment) => {
      let line = '';
      if (comment.type === 'table') {
        const table = model.tables[comment.tableId];
        const schema = model.schemas[table.schemaId];

        line += `ALTER TABLE ${shouldPrintSchema(schema, model)
          ? `\`${schema.name}\`.`
          : ''}\`${table.name}\` COMMENT = '${(table.note || '').replace(/'/g, '\'\'')}'`;
      }
      line += ';\n';
      return line;
    });
    return commentArr;
  }

  static export (model: NormalizedModel): string {
    const database = model.database['1'];

    const usedTableNames = new Set(Object.values(model.tables).map((table) => table.name));

    const statements = database.schemaIds.reduce((prevStatements, schemaId) => {
      const schema = model.schemas[schemaId];
      const { tableIds, refIds } = schema;

      if (shouldPrintSchema(schema, model)) {
        prevStatements.schemas.push(`CREATE SCHEMA \`${schema.name}\`;\n`);
      }

      if (!isEmpty(tableIds)) {
        prevStatements.tables.push(...MySQLExporter.exportTables(tableIds, model));
      }

      const indexIds = flatten(tableIds.map((tableId) => model.tables[tableId].indexIds));
      if (!isEmpty(indexIds)) {
        prevStatements.indexes.push(...MySQLExporter.exportIndexes(indexIds, model));
      }

      const commentNodes: CommentNode[] = flatten(tableIds.map((tableId) => {
        const { note } = model.tables[tableId];
        return note ? [{ type: 'table' as const, tableId }] : [];
      }));
      if (!isEmpty(commentNodes)) {
        prevStatements.comments.push(...MySQLExporter.exportComments(commentNodes, model));
      }

      if (!isEmpty(refIds)) {
        prevStatements.refs.push(...MySQLExporter.exportRefs(refIds, model, usedTableNames));
      }

      return prevStatements;
    }, {
      schemas: [] as string[],
      enums: [] as string[],
      tables: [] as string[],
      indexes: [] as string[],
      comments: [] as string[],
      refs: [] as string[],
    });

    // Export INSERT statements
    // Note: MySQL does not support DEFERRED constraints, so foreign key checks are disabled
    const insertStatements = MySQLExporter.exportRecords(model);
    const recordsSection = !isEmpty(insertStatements)
      ? [
          '-- Disable foreign key checks for INSERT',
          'SET FOREIGN_KEY_CHECKS = 0;',
          '',
          ...insertStatements,
          '',
          '-- Re-enable foreign key checks',
          'SET FOREIGN_KEY_CHECKS = 1;',
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

export default MySQLExporter;
