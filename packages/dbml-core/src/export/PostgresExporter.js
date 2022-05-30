import _ from 'lodash';
import { hasWhiteSpace, shouldPrintSchema } from './utils';
import { DEFAULT_SCHEMA_NAME } from '../model_structure/config';

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

    return enumArr;
  }

  static getFieldLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];

      let line = '';
      if (field.increment) {
        const typeSerial = field.type.type_name === 'bigint' ? 'BIGSERIAL' : 'SERIAL';
        line = `"${field.name}" ${typeSerial}`;
      } else {
        let schemaName = '';
        if (field.type.schemaName && field.type.schemaName !== DEFAULT_SCHEMA_NAME) {
          schemaName = hasWhiteSpace(field.type.schemaName) ? `"${field.type.schemaName}".` : `${field.type.schemaName}.`;
        }
        const typeName = hasWhiteSpace(field.type.type_name) ? `"${field.type.type_name}"` : field.type.type_name;
        line = `"${field.name}" ${schemaName}${typeName}`;
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

    return tableStrs;
  }

  static buildFieldName (fieldIds, model) {
    const fieldNames = fieldIds.map(fieldId => `"${model.fields[fieldId].name}"`).join(', ');
    return `(${fieldNames})`;
  }

  static buildJunctionFields1 (fieldIds, model) {
    const mapFieldKeys = new Map();
    fieldIds.map(fieldId => mapFieldKeys.set(`${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}`, model.fields[fieldId].type.type_name));
    return mapFieldKeys;
  }

  static buildJunctionFields2 (fieldIds, model, firstTableKey) {
    const mapFieldKeys = new Map();
    fieldIds.map((fieldId) => {
      let key = `${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}`;
      let count = 1;
      while (firstTableKey.has(key)) {
        key = `${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}(${count})`;
        count += 1;
      }
      mapFieldKeys.set(key, model.fields[fieldId].type.type_name);
    });
    return mapFieldKeys;
  }

  static buildTableManyToMany (firstTableKey, secondTableKey, tableName) {
    let line = `CREATE TABLE "${tableName}" (\n`;
    const key1s = [...firstTableKey.keys()].join('", "');
    const key2s = [...secondTableKey.keys()].join('", "');
    firstTableKey.forEach((value, key) => {
      line += `  "${key}" ${value} NOT NULL,\n`;
    });
    secondTableKey.forEach((value, key) => {
      line += `  "${key}" ${value} NOT NULL,\n`;
    });
    line += `  PRIMARY KEY ("${key1s}", "${key2s}")\n`;
    line += ');\n\n';
    return line;
  }

  static buildForeignKeyManyToMany (mapFieldKeys, foreignEndpointFields, refEndpointTableName, foreignEndpointTableName, schema, model) {
    const refEndpointFields = [...mapFieldKeys.keys()].join('", "');
    const line = `ALTER TABLE "${refEndpointTableName}" ADD FOREIGN KEY ("${refEndpointFields}") REFERENCES ${shouldPrintSchema(schema, model)
      ? `"${schema.name}".` : ''}"${foreignEndpointTableName}" ${foreignEndpointFields};\n\n`;
    return line;
  }

  static buildIndexManytoMany (keyTable, newTableName, nameTableRef, indexes, setIndexNewTableName) {
    let indexNewTableName = `${newTableName}_${nameTableRef}`;
    let count = 1;
    while ((Object.values(indexes).findIndex((index) => index.name === indexNewTableName) !== -1) || setIndexNewTableName.has(indexNewTableName)) {
      indexNewTableName = `${newTableName}_${nameTableRef}(${count})`;
      count += 1;
    }
    const indexFields = [...keyTable.keys()].join('", "');
    let line = `CREATE INDEX "idx_${indexNewTableName}" ON "${newTableName}" (`;
    line += `"${indexFields}");\n\n`;
    return line;
  }

  static buildNewTableName (firstTable, secondTable, tables, setNewTableName) {
    let nameNewTable = `${firstTable}_${secondTable}`;
    let count = 1;
    while ((Object.values(tables).findIndex((table) => table.name === nameNewTable) !== -1) || setNewTableName.has(nameNewTable)) {
      nameNewTable = `${firstTable}_${secondTable}(${count})`;
      count += 1;
    }
    setNewTableName.add(nameNewTable);
    return nameNewTable;
  }

  static exportRefs (refIds, model) {
    let setNewTableName = new Set();
    let setIndexNewTableName = new Set();
    const strArr = refIds.map((refId) => {
      let line = '';
      const ref = model.refs[refId];
      const refOneIndex = ref.endpointIds.findIndex(endpointId => model.endpoints[endpointId].relation === '1');
      const refEndpointIndex = refOneIndex === -1 ? 0 : refOneIndex;
      const foreignEndpointId = ref.endpointIds[1 - refEndpointIndex];
      const refEndpointId = ref.endpointIds[refEndpointIndex];
      const foreignEndpoint = model.endpoints[foreignEndpointId];
      const refEndpoint = model.endpoints[refEndpointId];

      const refEndpointField = model.fields[refEndpoint.fieldIds[0]];
      const refEndpointTable = model.tables[refEndpointField.tableId];
      const refEndpointSchema = model.schemas[refEndpointTable.schemaId];
      const refEndpointFieldName = this.buildFieldName(refEndpoint.fieldIds, model, 'postgres');

      const foreignEndpointField = model.fields[foreignEndpoint.fieldIds[0]];
      const foreignEndpointTable = model.tables[foreignEndpointField.tableId];
      const foreignEndpointSchema = model.schemas[foreignEndpointTable.schemaId];
      const foreignEndpointFieldName = this.buildFieldName(foreignEndpoint.fieldIds, model, 'postgres');

      if (refOneIndex === -1) { // many to many relationship
        const firstTableKey = this.buildJunctionFields1(refEndpoint.fieldIds, model, 'postgres');
        const secondTableKey = this.buildJunctionFields2(foreignEndpoint.fieldIds, model, firstTableKey);

        const nameNewTable = this.buildNewTableName(refEndpointTable.name, foreignEndpointTable.name, model.tables, setNewTableName);
        line += this.buildTableManyToMany(firstTableKey, secondTableKey, nameNewTable);

        if (firstTableKey.size > 1) {
          line += this.buildIndexManytoMany(firstTableKey, nameNewTable, refEndpointTable.name, model.tables, setIndexNewTableName);
        }

        if (secondTableKey.size > 1) {
          line += this.buildIndexManytoMany(secondTableKey, nameNewTable, foreignEndpointTable.name, model.tables, setIndexNewTableName);
        }
        line += this.buildForeignKeyManyToMany(firstTableKey, refEndpointFieldName, nameNewTable, refEndpointTable.name, refEndpointSchema, model);
        line += this.buildForeignKeyManyToMany(secondTableKey, foreignEndpointFieldName, nameNewTable, foreignEndpointTable.name, foreignEndpointSchema, model);
      } else {
        line = `ALTER TABLE ${shouldPrintSchema(foreignEndpointSchema, model)
          ? `"${foreignEndpointSchema.name}".` : ''}"${foreignEndpointTable.name}" ADD `;
        if (ref.name) { line += `CONSTRAINT "${ref.name}" `; }
        line += `FOREIGN KEY ${foreignEndpointFieldName} REFERENCES ${shouldPrintSchema(refEndpointSchema, model)
          ? `"${refEndpointSchema.name}".` : ''}"${refEndpointTable.name}" ${refEndpointFieldName}`;
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

    return indexArr;
  }

  static exportComments (comments, model) {
    const commentArr = comments.map((comment) => {
      let line = 'COMMENT ON';
      const table = model.tables[comment.tableId];
      const schema = model.schemas[table.schemaId];
      switch (comment.type) {
        case 'table': {
          line += ` TABLE ${shouldPrintSchema(schema, model)
            ? `"${schema.name}".` : ''}"${table.name}" IS '${table.note.replace(/'/g, '"')}'`;
          break;
        }
        case 'column': {
          const field = model.fields[comment.fieldId];
          line += ` COLUMN ${shouldPrintSchema(schema, model)
            ? `"${schema.name}".` : ''}"${table.name}"."${field.name}" IS '${field.note.replace(/'/g, '"')}'`;
          break;
        }
        default:
          break;
      }

      line += ';\n';

      return line;
    });

    return commentArr;
  }

  static export (model) {
    const database = model.database['1'];

    const statements = database.schemaIds.reduce((prevStatements, schemaId) => {
      const schema = model.schemas[schemaId];
      const { tableIds, enumIds, refIds } = schema;

      if (shouldPrintSchema(schema, model)) {
        prevStatements.schemas.push(`CREATE SCHEMA "${schema.name}";\n`);
      }

      if (!_.isEmpty(enumIds)) {
        prevStatements.enums.push(...PostgresExporter.exportEnums(enumIds, model));
      }

      if (!_.isEmpty(tableIds)) {
        prevStatements.tables.push(...PostgresExporter.exportTables(tableIds, model));
      }

      const indexIds = _.flatten(tableIds.map((tableId) => model.tables[tableId].indexIds));
      if (!_.isEmpty(indexIds)) {
        prevStatements.indexes.push(...PostgresExporter.exportIndexes(indexIds, model));
      }

      const commentNodes = _.flatten(tableIds.map((tableId) => {
        const { fieldIds, note } = model.tables[tableId];
        const fieldObjects = fieldIds
          .filter((fieldId) => model.fields[fieldId].note)
          .map((fieldId) => ({ type: 'column', fieldId, tableId }));
        return note ? [{ type: 'table', tableId }].concat(fieldObjects) : fieldObjects;
      }));
      if (!_.isEmpty(commentNodes)) {
        prevStatements.comments.push(...PostgresExporter.exportComments(commentNodes, model));
      }

      if (!_.isEmpty(refIds)) {
        prevStatements.refs.push(...PostgresExporter.exportRefs(refIds, model));
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

    const res = _.concat(
      statements.schemas,
      statements.enums,
      statements.tables,
      statements.indexes,
      statements.comments,
      statements.refs,
    ).join('\n');

    return res;
  }
}

export default PostgresExporter;
