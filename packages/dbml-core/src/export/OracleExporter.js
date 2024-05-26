import _ from 'lodash';
import {
  buildJunctionFields1,
  buildJunctionFields2,
  buildUniqueTableName,
  escapeObjectName,
  shouldPrintSchema,
} from './utils';

const oracleDataTypes = require('./DataTypes/OracleDataTypes');

class OracleExporter {
  static buildSchemaToTableNameSetMap (model) {
    const schemaToTableNameSetMap = new Map();

    _.forEach(model.tables, (table) => {
      const schema = model.schemas[table.schemaId];

      const tableSet = schemaToTableNameSetMap.get(schema.name);

      if (!tableSet) {
        schemaToTableNameSetMap.set(schema.name, new Set([table.name]));
        return;
      }

      tableSet.add(table.name);
    });

    return schemaToTableNameSetMap;
  }

  static buildTableNameWithSchema (model, schema, table) {
    return `${shouldPrintSchema(schema, model) ? `${escapeObjectName(schema.name, 'oracle')}.` : ''}${escapeObjectName(table.name, 'oracle')}`;
  }

  static exportSchema (schemaName) {
    // According to Oracle, CREATE SCHEMA statement does not actually create a schema and it automatically creates a schema when we create a user
    // Learn more: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-SCHEMA.html#GUID-2D154F9C-9E2B-4A09-B658-2EA5B99AC838__GUID-CC0A5080-2AF3-4460-AB2B-DEA6C79519BA
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
      let fieldType = field.type.type_name;

      let line = fieldName;

      if (field.enumId) {
        const _enum = model.enums[field.enumId];

        const enumValues = _enum.valueIds.map(valueId => {
          const value = model.enumValues[valueId];
          return `'${value.name}'`;
        });

        const enumString = enumValues.join(', ');
        line += ` nvarchar2(255) NOT NULL CHECK (${fieldName} IN (${enumString}))`;
        fieldType = 'nvarchar2(255)';
      } else {
        line += ` ${field.type.type_name}`;
      }

      const cloneField = { ...field };

      if (cloneField.increment) {
        line += ' GENERATED AS IDENTITY';

        // in oracle, increment means using identity. If a clause includes identity, we must ignore not null + default value
        cloneField.dbdefault = null;
        cloneField.not_null = false;
      }

      if (cloneField.unique) {
        line += ' UNIQUE';
      }
      if (cloneField.pk) {
        line += ' PRIMARY KEY';
      }

      if (cloneField.not_null) {
        line += ' NOT NULL';
      }

      if (cloneField.dbdefault) {
        if (cloneField.dbdefault.type === 'string') {
          line += ` DEFAULT '${cloneField.dbdefault.value}'`;
        } else {
          line += ` DEFAULT ${cloneField.dbdefault.value}`;
        }
      }

      const index = fieldType.indexOf('(');
      let fieldTypeCheck;

      if (index !== -1) {
        fieldTypeCheck = fieldType.substring(0, index);
      } else {
        fieldTypeCheck = fieldType;
      }

      if (!oracleDataTypes.includes(fieldTypeCheck.toUpperCase())) {
        line += `, -- ${fieldType} data type is not supported in Oracle`;
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
      const fieldContents = this.getFieldLines(tableId, model);
      const compositePKs = this.getCompositePKs(tableId, model);

      return {
        tableId,
        fieldContents,
        compositePKs,
      };
    });

    return tableContentArr;
  }

  static exportTables (tableIds, model) {
    const tableContentList = this.getTableContents(tableIds, model);

    const tableStrs = tableContentList.map((tableContent) => {
      const content = [...tableContent.fieldContents, ...tableContent.compositePKs];
      const table = model.tables[tableContent.tableId];
      const schema = model.schemas[table.schemaId];

      const tableName = this.buildTableNameWithSchema(model, schema, table);
      const contentString = content.map(line => `  ${line}`).join(',\n');

      const tableStr = `CREATE TABLE ${tableName} (\n${contentString}\n);\n`;
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
    line += `  PRIMARY KEY ("${key1s}", "${key2s}")\n);\n`;

    return line;
  }

  static buildForeignKeyManyToMany (foreignEndpointTableName, foreignEndpointFields, refEndpointTableName, refEndpointFieldsString) {
    const foreignEndpointFieldsString = [...foreignEndpointFields.keys()].join('`, `');
    const line = `ALTER TABLE ${foreignEndpointTableName} ADD FOREIGN KEY ("${foreignEndpointFieldsString}") REFERENCES ${refEndpointTableName} ${refEndpointFieldsString};\n`;
    return line;
  }

  static exportReferencesAndNewTablesIfExists (refIds, model, usedTableNameMap) {
    const result = { refs: [], tables: [] };

    refIds.forEach((refId) => {
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

      if (refOneIndex !== -1) {
        const foreignTableName = this.buildTableNameWithSchema(model, foreignEndpointSchema, foreignEndpointTable);
        let line = `ALTER TABLE ${foreignTableName} ADD`;

        if (ref.name) {
          line += ` CONSTRAINT ${escapeObjectName(ref.name, 'oracle')}`;
        }

        const refTableName = this.buildTableNameWithSchema(model, refEndpointSchema, refEndpointTable);
        line += ` FOREIGN KEY ${foreignEndpointFieldNameString} REFERENCES ${refTableName} ${refEndpointFieldNameString}`;

        if (ref.onDelete) {
          line += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
        }

        line += ';\n';
        result.refs.push(line);
        return;
      }

      // many to many relationship
      const firstTableFieldsMap = buildJunctionFields1(refEndpoint.fieldIds, model);
      const secondTableFieldsMap = buildJunctionFields2(foreignEndpoint.fieldIds, model, firstTableFieldsMap);

      const newTableName = buildUniqueTableName(refEndpointSchema, refEndpointTable.name, foreignEndpointTable.name, usedTableNameMap);
      const tableNameSet = usedTableNameMap.get(refEndpointSchema);
      if (!tableNameSet) {
        usedTableNameMap.set(refEndpointSchema, new Set([newTableName]));
      } else {
        tableNameSet.add(newTableName);
      }

      const escapedNewTableName = `${shouldPrintSchema(refEndpointSchema, model)
          ? `"${refEndpointSchema.name}".` : ''}"${newTableName}"`;

      result.tables.push(this.buildTableManyToMany(firstTableFieldsMap, secondTableFieldsMap, escapedNewTableName));

      const firstTableName = this.buildTableNameWithSchema(model, refEndpointSchema, refEndpointTable);
      result.refs.push(
          this.buildForeignKeyManyToMany(
              escapedNewTableName,
              firstTableFieldsMap,
              firstTableName,
              refEndpointFieldNameString,
          ),
      );

      const secondTableName = this.buildTableNameWithSchema(model, foreignEndpointSchema, foreignEndpointTable);
      result.refs.push(
          this.buildForeignKeyManyToMany(
              escapedNewTableName,
              secondTableFieldsMap,
              secondTableName,
              foreignEndpointFieldNameString,
          ),
      );
    });

    return result;
  }

  static exportReferenceGrants (model, refIds) {
    // only default schema -> ignore it
    if (Object.keys(model.schemas).length <= 1) {
      return [];
    }
    const tableNameList = [];
    refIds.forEach((refId) => {
      const ref = model.refs[refId];

      // find the one relation in one - many, many - one, one - one relationship
      const refOneIndex = ref.endpointIds.findIndex(endpointId => model.endpoints[endpointId].relation === '1');
      const refEndpointIndex = refOneIndex === -1 ? 0 : refOneIndex;

      const refEndpointId = ref.endpointIds[refEndpointIndex];
      const refEndpoint = model.endpoints[refEndpointId];
      const refEndpointField = model.fields[refEndpoint.fieldIds[0]];
      const refEndpointTable = model.tables[refEndpointField.tableId];
      const refEndpointSchema = model.schemas[refEndpointTable.schemaId];

      // refEndpointIndex could be 0 or 1, so use 1 - refEndpointIndex will take the remained index
      const foreignEndpointId = ref.endpointIds[1 - refEndpointIndex];
      const foreignEndpoint = model.endpoints[foreignEndpointId];
      const foreignEndpointField = model.fields[foreignEndpoint.fieldIds[0]];
      const foreignEndpointTable = model.tables[foreignEndpointField.tableId];
      const foreignEndpointSchema = model.schemas[foreignEndpointTable.schemaId];

      // reference in the same schema
      if (refEndpointSchema.name === foreignEndpointSchema.name) {
        tableNameList.push('');
        return;
      }

      const refTableName = this.buildTableNameWithSchema(model, refEndpointSchema, refEndpointTable);
      // refTableName is always needed to be grant
      tableNameList.push(refTableName);

      // one - many, many - one, one - one relationship
      if (refOneIndex !== -1) {
        return;
      }

      const foreignTableName = this.buildTableNameWithSchema(model, foreignEndpointSchema, foreignEndpointTable);
      tableNameList.push(foreignTableName);
    });

    const tableToGrantList = tableNameList
        // remove duplicate
        .filter((table, index) => table && tableNameList.indexOf(table) === index)
        // map into grant statement
        .map((table) => `GRANT REFERENCES ON ${table} TO PUBLIC;\n`);

    return tableToGrantList;
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

    const schemaToTableNameSetMap = this.buildSchemaToTableNameSetMap(model);

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
        const { refs, tables: manyToManyTables } = this.exportReferencesAndNewTablesIfExists(refIds, model, schemaToTableNameSetMap);
        prevStatements.tables.push(...manyToManyTables);
        prevStatements.refs.push(...refs);

        prevStatements.referenceGrants.push(...this.exportReferenceGrants(model, refIds));
      }

      return prevStatements;
    }, {
      schemas: [],
      tables: [],
      indexes: [],
      comments: [],
      referenceGrants: [],
      refs: [],
    });

    const res = _.concat(
        statements.schemas,
        statements.tables,
        statements.indexes,
        statements.comments,
        statements.referenceGrants,
        statements.refs,
    ).join('\n');
    return res;
  }
}

export default OracleExporter;
