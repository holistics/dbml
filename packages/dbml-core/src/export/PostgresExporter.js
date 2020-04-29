import _ from 'lodash';
import { hasWhiteSpace, shouldPrintSchema } from './utils';

class PostgresExporter {
  static exportEnums (enumIds, model) {
    const enumArr = enumIds.map((enumId) => {
      const _enum = model.enums[enumId];
      const schema = model.schemas[_enum.schemaId];

      const enumValueArr = _enum.valueIds.map((valueId) => {
        const value = model.enumValues[valueId];
        return `  '${value.name}'`;
      });
      const enumValueStr = enumValueArr.join(',\n');

      const line = `CREATE TYPE ${shouldPrintSchema(schema, model)
        ? `"${schema.name}".` : ''}"${_enum.name}" AS ENUM (\n${enumValueStr}\n);\n`;
      return line;
    });

    return enumArr.length ? enumArr.join('\n') : '';
  }

  static getFieldLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];

      let line = '';
      if (field.increment) {
        const typeSerial = field.type.type_name === 'bigint' ? 'BIGSERIAL' : 'SERIAL';
        line = `"${field.name}" ${typeSerial}`;
      } else if (hasWhiteSpace(field.type.type_name)) {
        line = `"${field.name}" "${field.type.type_name}"`;
      } else {
        line = `"${field.name}" ${field.type.type_name}`;
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
      if (field.dbdefault) {
        if (field.dbdefault.type === 'expression') {
          line += ` DEFAULT (${field.dbdefault.value})`;
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
          columnStr = `"${column.value}"`;
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
      const fieldContents = PostgresExporter.getFieldLines(tableId, model);
      const compositePKs = PostgresExporter.getCompositePKs(tableId, model);

      return {
        tableId,
        fieldContents,
        compositePKs,
      };
    });

    return tableContentArr;
  }

  static exportTables (tableIds, model) {
    const tableContentArr = PostgresExporter.getTableContentArr(tableIds, model);

    const tableStrs = tableContentArr.map((tableContent) => {
      const content = [...tableContent.fieldContents, ...tableContent.compositePKs];
      const table = model.tables[tableContent.tableId];
      const schema = model.schemas[table.schemaId];
      const tableStr = `CREATE TABLE ${shouldPrintSchema(schema, model)
        ? `"${schema.name}".` : ''}"${table.name}" (\n${
        content.map(line => `  ${line}`).join(',\n')}\n);\n`;
      return tableStr;
    });

    return tableStrs.length ? tableStrs.join('\n') : '';
  }

  static exportRefs (refIds, model) {
    const strArr = refIds.map((refId) => {
      const ref = model.refs[refId];
      const refEndpointIndex = ref.endpointIds.findIndex(endpointId => model.endpoints[endpointId].relation === '1');
      const foreignEndpointId = ref.endpointIds[1 - refEndpointIndex];
      const refEndpointId = ref.endpointIds[refEndpointIndex];
      const foreignEndpoint = model.endpoints[foreignEndpointId];
      const refEndpoint = model.endpoints[refEndpointId];

      const refEndpointField = model.fields[refEndpoint.fieldId];
      const refEndpointTable = model.tables[refEndpointField.tableId];
      const refEndpointSchema = model.schemas[refEndpointTable.schemaId];

      const foreignEndpointField = model.fields[foreignEndpoint.fieldId];
      const foreignEndpointTable = model.tables[foreignEndpointField.tableId];
      const foreignEndpointSchema = model.schemas[foreignEndpointTable.schemaId];

      let line = `ALTER TABLE ${shouldPrintSchema(foreignEndpointSchema, model)
        ? `"${foreignEndpointSchema.name}".` : ''}"${foreignEndpointTable.name}" ADD `;
      if (ref.name) { line += `CONSTRAINT "${ref.name}" `; }
      line += `FOREIGN KEY ("${foreignEndpointField.name}") REFERENCES ${shouldPrintSchema(refEndpointSchema, model)
        ? `"${refEndpointSchema.name}".` : ''}"${refEndpointTable.name}" ("${refEndpointField.name}")`;
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
    const indexArr = indexIds.filter((indexId) => !model.indexes[indexId].pk).map((indexId) => {
      const index = model.indexes[indexId];
      const table = model.tables[index.tableId];
      const schema = model.schemas[table.schemaId];

      let line = 'CREATE';
      if (index.unique) {
        line += ' UNIQUE';
      }
      const indexName = index.name ? `"${index.name}"` : '';
      line += ' INDEX';
      if (indexName) {
        line += ` ${indexName}`;
      }
      line += ` ON ${shouldPrintSchema(schema, model)
        ? `"${schema.name}".` : ''}"${table.name}"`;
      if (index.type) {
        line += ` USING ${index.type.toUpperCase()}`;
      }

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

    return indexArr.length ? indexArr.join('\n') : '';
  }

  static exportComments (comments, model) {
    const commentArr = comments.map((comment) => {
      let line = 'COMMENT ON';

      if (comment.type === 'column') {
        const field = model.fields[comment.fieldId];
        const table = model.tables[field.tableId];
        const schema = model.schemas[table.schemaId];

        line += ` COLUMN ${shouldPrintSchema(schema, model)
          ? `"${schema.name}".` : ''}"${table.name}"."${field.name}" IS '${field.note}'`;
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
      const { tableIds, enumIds, refIds } = schema;

      if (shouldPrintSchema(schema, model)) {
        if (hasBlockAbove) res += '\n';
        res += `CREATE SCHEMA "${schema.name}";\n`;
        hasBlockAbove = true;
      }

      if (!_.isEmpty(enumIds)) {
        if (hasBlockAbove) res += '\n';
        res += PostgresExporter.exportEnums(enumIds, model);
        hasBlockAbove = true;
      }

      if (!_.isEmpty(tableIds)) {
        if (hasBlockAbove) res += '\n';
        res += PostgresExporter.exportTables(tableIds, model);
        hasBlockAbove = true;
      }

      if (!_.isEmpty(refIds)) {
        if (hasBlockAbove) res += '\n';
        res += PostgresExporter.exportRefs(refIds, model);
        hasBlockAbove = true;
      }

      indexIds.push(...(_.flatten(tableIds.map((tableId) => model.tables[tableId].indexIds))));
      comments.push(...(_.flatten(tableIds.map((tableId) => {
        const { fieldIds } = model.tables[tableId];
        return fieldIds
          .filter((fieldId) => model.fields[fieldId].note)
          .map((fieldId) => ({ type: 'column', fieldId }));
      }))));
    });

    if (!_.isEmpty(indexIds)) {
      if (hasBlockAbove) res += '\n';
      res += PostgresExporter.exportIndexes(indexIds, model);
      hasBlockAbove = true;
    }

    if (!_.isEmpty(comments)) {
      if (hasBlockAbove) res += '\n';
      res += PostgresExporter.exportComments(comments, model);
      hasBlockAbove = true;
    }

    return res;
  }
}

export default PostgresExporter;
