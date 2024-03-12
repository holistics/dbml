import _ from 'lodash';
import {
  buildJunctionFields1,
  buildJunctionFields2,
  buildNewTableName,
  escapeObjectName,
  shouldPrintSchema,
} from './utils';

class OracleExporter {
  static buildTableNameWithSchema (model, schema, table) {
    return `${shouldPrintSchema(schema, model) ? `${escapeObjectName(schema.name, 'oracle')}.` : ''}${escapeObjectName(table.name, 'oracle')}`;
  }

  static exportSchema (schemaName) {
    return `CREATE USER ${escapeObjectName(schemaName, 'oracle')}\n`
      + 'NO AUTHENTICATION\n'
      + 'DEFAULT TABLESPACE system\n'
      + 'TEMPORARY TABLESPACE temp\n'
      + 'QUOTA UNLIMITED ON system;\n';
  }

  static getFieldLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];
      const fieldName = escapeObjectName(field.name, 'oracle');

      let line = fieldName;

      if (field.enumId) {
        const _enum = model.enums[field.enumId];

        const enumValues = _enum.valueIds.map(valueId => {
          const value = model.enumValues[valueId];
          return `'${value.name}'`;
        });

        const enumString = enumValues.join(', ');
        line += ` nvarchar2(255) NOT NULL CHECK (${fieldName} IN (${enumString}))`;
      } else {
        line += ` ${field.type.type_name}`;
      }

      if (field.increment) {
        line += ' GENERATED AS IDENTITY';
      }

      if (field.unique) {
        line += ' UNIQUE';
      }
      if (field.pk) {
        line += ' PRIMARY KEY';
      }

      // in oracle, increment means using identity. If a clause includes identity, we must ignore not null
      if (field.not_null && !field.increment) {
        line += ' NOT NULL';
      }

      if (field.dbdefault) {
        if (field.dbdefault.type === 'string') {
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

  static getTableContents (tableIds, model) {
    const tableContentArr = tableIds.map((tableId) => {
      const fieldContents = OracleExporter.getFieldLines(tableId, model);
      const compositePKs = OracleExporter.getCompositePKs(tableId, model);

      return {
        tableId,
        fieldContents,
        compositePKs,
      };
    });

    return tableContentArr;
  }

  static exportTables (tableIds, model) {
    const tableContentList = OracleExporter.getTableContents(tableIds, model);

    const tableStrs = tableContentList.map((tableContent) => {
      const content = [...tableContent.fieldContents, ...tableContent.compositePKs];
      const table = model.tables[tableContent.tableId];
      const schema = model.schemas[table.schemaId];

      const tableName = this.buildTableNameWithSchema(model, schema, table);
      const constentString = content.map(line => `  ${line}`).join(',\n');

      const tableStr = `CREATE TABLE ${tableName} (\n${constentString}\n);\n`;
      return tableStr;
    });

    return tableStrs;
  }

  static buildReferenceFieldNamesString (fieldIds, model) {
    const fieldNames = fieldIds.map(fieldId => `"${model.fields[fieldId].name}"`).join(', ');
    return `(${fieldNames})`;
  }

  static buildTableManyToMany (firstTableFieldsMap, secondTableFieldsMap, tableName) {
    let line = `CREATE TABLE ${tableName} (\n`;

    firstTableFieldsMap.forEach((fieldType, fieldName) => {
      line += `  "${fieldName}" ${fieldType},\n`;
    });

    secondTableFieldsMap.forEach((fieldType, fieldName) => {
      line += `  "${fieldName}" ${fieldType},\n`;
    });

    const key1s = [...firstTableFieldsMap.keys()].join('`, `');
    const key2s = [...secondTableFieldsMap.keys()].join('`, `');
    line += `  PRIMARY KEY ("${key1s}", "${key2s}")\n);\n\n`;

    return line;
  }

  static buildForeignKeyManyToMany (fieldsMap, foreignEndpointFieldsString, refEndpointTableName, foreignEndpointTableName) {
    const refEndpointFields = [...fieldsMap.keys()].join('`, `');
    const line = `ALTER TABLE ${foreignEndpointFieldsString} ADD FOREIGN KEY ("${refEndpointFields}") REFERENCES ${foreignEndpointTableName} ${refEndpointTableName};\n\n`;
    return line;
  }

  static exportRefs (refIds, model, usedTableNames) {
    const strArr = refIds.map((refId) => {
      let line = '';
      const ref = model.refs[refId];

      // find the one relation in one-to-xxx or xxx-to-one relationship
      const refOneIndex = ref.endpointIds.findIndex(endpointId => model.endpoints[endpointId].relation === '1');

      const refEndpointIndex = refOneIndex === -1 ? 0 : refOneIndex;

      // refEndpointIndex could be 0 or 1, so use 1 - refEndpointIndex will take the remained index
      const foreignEndpointId = ref.endpointIds[1 - refEndpointIndex];
      const foreignEndpoint = model.endpoints[foreignEndpointId];
      const foreignEndpointField = model.fields[foreignEndpoint.fieldIds[0]];
      const foreignEndpointTable = model.tables[foreignEndpointField.tableId];
      const foreignEndpointSchema = model.schemas[foreignEndpointTable.schemaId];
      const foreignEndpointFieldNameString = this.buildReferenceFieldNamesString(foreignEndpoint.fieldIds, model);

      const refEndpointId = ref.endpointIds[refEndpointIndex];
      const refEndpoint = model.endpoints[refEndpointId];
      const refEndpointField = model.fields[refEndpoint.fieldIds[0]];
      const refEndpointTable = model.tables[refEndpointField.tableId];
      const refEndpointSchema = model.schemas[refEndpointTable.schemaId];
      const refEndpointFieldNameString = this.buildReferenceFieldNamesString(refEndpoint.fieldIds, model);

      // many to many relationship
      if (refOneIndex === -1) {
        const firstTableFieldsMap = buildJunctionFields1(refEndpoint.fieldIds, model);
        const secondTableFieldsMap = buildJunctionFields2(foreignEndpoint.fieldIds, model, firstTableFieldsMap);

        const newTableName = buildNewTableName(refEndpointTable.name, foreignEndpointTable.name, usedTableNames);
        const escapedNewTableName = `${shouldPrintSchema(refEndpointSchema, model)
          ? `"${refEndpointSchema.name}".` : ''}"${newTableName}"`;

        line += this.buildTableManyToMany(firstTableFieldsMap, secondTableFieldsMap, escapedNewTableName);

        const firstTableName = this.buildTableNameWithSchema(model, refEndpointSchema, refEndpointTable);
        line += this.buildForeignKeyManyToMany(firstTableFieldsMap, newTableName, refEndpointFieldNameString, firstTableName);

        const secondTableName = this.buildTableNameWithSchema(model, foreignEndpointSchema, foreignEndpointTable);
        line += this.buildForeignKeyManyToMany(secondTableFieldsMap, newTableName, foreignEndpointFieldNameString, secondTableName);
      } else {
        const foreignTableName = this.buildTableNameWithSchema(model, foreignEndpointSchema, foreignEndpointTable);
        line = `ALTER TABLE ${foreignTableName} ADD`;

        if (ref.name) {
          line += ` CONSTRAINT ${escapeObjectName(ref.name, 'oracle')}`;
        }

        const refTableName = this.buildTableNameWithSchema(model, refEndpointSchema, refEndpointTable);
        line += ` FOREIGN KEY ${foreignEndpointFieldNameString} REFERENCES ${refTableName} ${refEndpointFieldNameString}`;

        if (ref.onDelete) {
          line += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
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
      // ignore dbml index type: b-tree, hash
      if (index.unique) {
        line += ' UNIQUE';
      }

      line += ' INDEX';

      if (index.name) {
        line += ` ${escapeObjectName(index.name, 'oracle')}`;
      }

      const tableName = this.buildTableNameWithSchema(model, schema, table);
      line += ` ON ${tableName}`;

      const columnArr = [];
      index.columnIds.forEach((columnId) => {
        const column = model.indexColumns[columnId];
        let columnStr = '';
        if (column.type === 'expression') {
          columnStr = `${column.value}`;
        } else {
          columnStr = `"${column.value}"`;
        }
        columnArr.push(columnStr);
      });

      const columnString = columnArr.join(', ');
      line += ` (${columnString});\n`;
      return line;
    });

    return indexArr;
  }

  static exportComments (comments, model) {
    const commentArr = comments.map((comment) => {
      let line = 'COMMENT ON';

      const table = model.tables[comment.tableId];
      const schema = model.schemas[table.schemaId];

      const tableName = this.buildTableNameWithSchema(model, schema, table);

      switch (comment.type) {
        case 'table': {
          line += ` TABLE ${tableName} IS '${table.note.replace(/'/g, "''")}'`;
          break;
        }
        case 'column': {
          const field = model.fields[comment.fieldId];
          line += ` COLUMN ${tableName}.${escapeObjectName(field.name, 'oracle')} IS '${field.note.replace(/'/g, "''")}'`;
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

    const usedTableNames = new Set(Object.values(model.tables).map(table => table.name));

    const statements = database.schemaIds.reduce((prevStatements, schemaId) => {
      const schema = model.schemas[schemaId];
      const { tableIds, refIds } = schema;

      if (shouldPrintSchema(schema, model)) {
        prevStatements.schemas.push(this.exportSchema(schema.name));
      }

      if (!_.isEmpty(tableIds)) {
        prevStatements.tables.push(...this.exportTables(tableIds, model));
      }

      const indexIds = _.flatten(tableIds.map((tableId) => model.tables[tableId].indexIds));
      if (!_.isEmpty(indexIds)) {
        prevStatements.indexes.push(...this.exportIndexes(indexIds, model));
      }

      const commentNodes = _.flatten(tableIds.map((tableId) => {
        const { fieldIds, note } = model.tables[tableId];
        const fieldObjects = fieldIds
          .filter((fieldId) => model.fields[fieldId].note)
          .map((fieldId) => ({ type: 'column', fieldId, tableId }));
        return note ? [{ type: 'table', tableId }].concat(fieldObjects) : fieldObjects;
      }));

      if (!_.isEmpty(commentNodes)) {
        prevStatements.comments.push(...this.exportComments(commentNodes, model));
      }

      if (!_.isEmpty(refIds)) {
        prevStatements.refs.push(...this.exportRefs(refIds, model, usedTableNames));
      }

      return prevStatements;
    }, {
      schemas: [],
      tables: [],
      indexes: [],
      comments: [],
      refs: [],
    });

    const res = _.concat(
      statements.schemas,
      statements.tables,
      statements.indexes,
      statements.comments,
      statements.refs,
    ).join('\n');
    return res;
  }
}

export default OracleExporter;