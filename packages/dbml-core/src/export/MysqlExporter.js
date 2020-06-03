import _ from 'lodash';
import { shouldPrintSchema } from './utils';

class MySQLExporter {
  static getFieldLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];
      let line = '';

      if (field.enumId) {
        const _enum = model.enums[field.enumId];
        line = `\`${field.name}\` ENUM (`;
        const enumValues = _enum.valueIds.map(valueId => {
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
      if (field.dbdefault) {
        if (field.dbdefault.type === 'expression') {
          line += ` DEFAULT (${field.dbdefault.value})`;
        } else if (field.dbdefault.type === 'string') {
          line += ` DEFAULT "${field.dbdefault.value}"`;
        } else {
          line += ` DEFAULT ${field.dbdefault.value}`;
        }
      }
      if (field.note) {
        line += ` COMMENT '${field.note}'`;
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
      let line = 'PRIMARY KEY';
      const columnArr = [];

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

  static getTableContentArr (tableIds, model) {
    const tableContentArr = tableIds.map((tableId) => {
      const fieldContents = MySQLExporter.getFieldLines(tableId, model);
      const compositePKs = MySQLExporter.getCompositePKs(tableId, model);

      return {
        tableId,
        fieldContents,
        compositePKs,
      };
    });

    return tableContentArr;
  }

  static exportTables (tableIds, model) {
    const tableContentArr = MySQLExporter.getTableContentArr(tableIds, model);

    const tableStrs = tableContentArr.map((tableContent) => {
      const content = [...tableContent.fieldContents, ...tableContent.compositePKs];
      const table = model.tables[tableContent.tableId];
      const schema = model.schemas[table.schemaId];
      const tableStr = `CREATE TABLE ${shouldPrintSchema(schema, model)
        ? `\`${schema.name}\`.` : ''}\`${table.name}\` (\n${
        content.map(line => `  ${line}`).join(',\n')}\n);\n`;
      return tableStr;
    });

    return tableStrs.length ? tableStrs.join('\n') : '';
  }

  static buildFieldName (fieldIds, model) {
    const fieldNames = fieldIds.map(fieldId => `\`${model.fields[fieldId].name}\``).join(', ');
    return `(${fieldNames})`;
  }

  static exportRefs (refIds, model) {
    const strArr = refIds.map((refId) => {
      const ref = model.refs[refId];
      const refEndpointIndex = ref.endpointIds.findIndex(endpointId => model.endpoints[endpointId].relation === '1');
      const foreignEndpointId = ref.endpointIds[1 - refEndpointIndex];
      const refEndpointId = ref.endpointIds[refEndpointIndex];
      const foreignEndpoint = model.endpoints[foreignEndpointId];
      const refEndpoint = model.endpoints[refEndpointId];

      const refEndpointField = model.fields[refEndpoint.fieldIds[0]];
      const refEndpointTable = model.tables[refEndpointField.tableId];
      const refEndpointSchema = model.schemas[refEndpointTable.schemaId];
      const refEndpointFieldName = this.buildFieldName(refEndpoint.fieldIds, model, 'mysql');

      const foreignEndpointField = model.fields[foreignEndpoint.fieldIds[0]];
      const foreignEndpointTable = model.tables[foreignEndpointField.tableId];
      const foreignEndpointSchema = model.schemas[foreignEndpointTable.schemaId];
      const foreignEndpointFieldName = this.buildFieldName(foreignEndpoint.fieldIds, model, 'mysql');

      let line = `ALTER TABLE ${shouldPrintSchema(foreignEndpointSchema, model)
        ? `\`${foreignEndpointSchema.name}\`.` : ''}\`${foreignEndpointTable.name}\` ADD `;

      if (ref.name) {
        line += `CONSTRAINT \`${ref.name}\` `;
      }

      line += `FOREIGN KEY ${foreignEndpointFieldName} REFERENCES ${shouldPrintSchema(refEndpointSchema, model)
        ? `\`${refEndpointSchema.name}\`.` : ''}\`${refEndpointTable.name}\` ${refEndpointFieldName}`;
      if (ref.onDelete) {
        line += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
      }
      if (ref.onUpdate) {
        line += ` ON UPDATE ${ref.onUpdate.toUpperCase()}`;
      }
      line += ';\n';

      return line;
    });

    return strArr.length ? strArr.join('\n') : '';
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
      const indexName = index.name ? `\`${index.name}\`` : `\`${shouldPrintSchema(schema, model)
        ? `\`${schema.name}\`.` : ''}${table.name}_index_${i}\``;
      line += ` INDEX ${indexName} ON ${shouldPrintSchema(schema, model)
        ? `\`${schema.name}\`.` : ''}\`${table.name}\``;

      const columnArr = [];
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

    return indexArr.length ? indexArr.join('\n') : '';
  }

  static exportComments (comments, model) {
    const commentArr = comments.map((comment) => {
      let line = '';
      if (comment.type === 'table') {
        const table = model.tables[comment.tableId];
        line += `ALTER TABLE \`${table.name}\` COMMENT = "${table.note.replace(/"/g, "'")}"`;
      }
      line += ';\n';
      return line;
    });
    return commentArr.length ? commentArr.join('\n') : '';
  }

  static export (model) {
    let res = '';
    let hasBlockAbove = false;
    const database = model.database['1'];
    const indexIds = [];
    const comments = [];

    database.schemaIds.forEach((schemaId) => {
      const schema = model.schemas[schemaId];
      const { tableIds, refIds } = schema;

      if (shouldPrintSchema(schema, model)) {
        if (hasBlockAbove) res += '\n';
        res += `CREATE DATABASE \`${schema.name}\`;\n`;
        hasBlockAbove = true;
      }

      if (!_.isEmpty(tableIds)) {
        if (hasBlockAbove) res += '\n';
        res += MySQLExporter.exportTables(tableIds, model);
        hasBlockAbove = true;
      }

      if (!_.isEmpty(refIds)) {
        if (hasBlockAbove) res += '\n';
        res += MySQLExporter.exportRefs(refIds, model);
        hasBlockAbove = true;
      }

      indexIds.push(...(_.flatten(tableIds.map((tableId) => model.tables[tableId].indexIds))));
      comments.push(...(_.flatten(tableIds.map((tableId) => {
        const { note } = model.tables[tableId];
        return note ? [{type: 'table', tableId}] : [];
      }))));
    });

    if (!_.isEmpty(indexIds)) {
      if (hasBlockAbove) res += '\n';
      res += MySQLExporter.exportIndexes(indexIds, model);
      hasBlockAbove = true;
    }

    if (!_.isEmpty(comments)) {
      if (hasBlockAbove) res += '\n';
      res += MySQLExporter.exportComments(comments, model);
      hasBlockAbove = true;
    }
    return res;
  }
}

export default MySQLExporter;
