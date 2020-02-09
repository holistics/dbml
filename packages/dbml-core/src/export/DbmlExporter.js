import _ from 'lodash';
import { shouldPrintSchema } from './utils';

class DbmlExporter {
  static hasWhiteSpace (str) {
    return /\s/g.test(str);
  }

  static isExpression (str) {
    return /\s*(\*|\+|-|\([A-Za-z0-9_]+\)|\(\))/g.test(str);
  }

  static exportEnums (enumIds, model) {
    const enumStrs = enumIds.map(enumId => {
      const _enum = model.enums[enumId];
      const schema = model.schemas[_enum.schemaId];

      return `Enum ${shouldPrintSchema(schema, model)
        ? `"${schema.name}".` : ''}"${_enum.name}" {\n${
        _enum.valueIds.map(valueId => `  "${model.enumValues[valueId].name}"${model.enumValues[valueId].note
          ? ` [note: '${model.enumValues[valueId].note}']` : ''}`).join('\n')}\n}\n`;
    });

    return enumStrs.length ? enumStrs.join('\n') : '';
  }

  static getFieldLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];

      let line = `"${field.name}" ${DbmlExporter.hasWhiteSpace(field.type.type_name)
        ? `"${field.type.type_name}"` : field.type.type_name}`;

      const constraints = [];
      if (field.unique) {
        constraints.push('unique');
      }
      if (field.pk) {
        constraints.push('pk');
      }
      if (field.not_null) {
        constraints.push('not null');
      }
      if (field.increment) {
        constraints.push('increment');
      }
      if (field.dbdefault) {
        let value = 'default: ';
        switch (field.dbdefault.type) {
          case 'boolean':
          case 'number':
            value += `${field.dbdefault.value}`;
            break;

          case 'string':
            value += `"${field.dbdefault.value}"`;
            break;

          case 'expression':
            value += `\`${field.dbdefault.value}\``;
            break;

          default:
            break;
        }
        constraints.push(value);
      }
      if (field.note) {
        constraints.push(`note: '${field.note}'`);
      }

      if (constraints.length > 0) {
        line += ` [${constraints.join(', ')}]`;
      }
      return line;
    });

    return lines;
  }

  static getIndexLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.indexIds.map((indexId) => {
      let line = '';
      const index = model.indexes[indexId];

      if (index.columnIds.length > 1) {
        line = `(${index.columnIds.map((columnId) => {
          const column = model.indexColumns[columnId];
          if (column.type === 'expression') {
            return `\`${column.value}\``;
          }
          return column.value;
        }).join(', ')})`;
      } else if (index.columnIds.length === 1) {
        const column = model.indexColumns[index.columnIds[0]];
        line = column.type === 'expression'
          ? `\`${column.value}\`` : column.value;
      }

      const indexSettings = [];
      if (index.pk) {
        indexSettings.push('pk');
      }
      if (index.type) {
        indexSettings.push(`type: ${index.type.toLowerCase()}`);
      }
      if (index.unique) {
        indexSettings.push('unique');
      }
      if (index.name) {
        indexSettings.push(`name: "${index.name}"`);
      }

      if (indexSettings.length > 1) {
        line += ` [${indexSettings.join(', ')}]`;
      } else if (indexSettings.length === 1) {
        line += ` [${indexSettings[0]}]`;
      }
      return line;
    });

    return lines;
  }

  static getTableContentArr (tableIds, model) {
    const tableContentArr = tableIds.map((tableId) => {
      const fieldContents = DbmlExporter.getFieldLines(tableId, model);
      const indexContents = DbmlExporter.getIndexLines(tableId, model);

      return {
        tableId,
        fieldContents,
        indexContents,
      };
    });

    return tableContentArr;
  }

  static getTableSettings (table) {
    let settingStr = '';
    const settingSep = ', ';
    if (table.headerColor) {
      settingStr += `headerColor: ${table.headerColor}${settingSep}`;
    }
    if (table.note) {
      settingStr += `note: '${table.note}'${settingSep}`;
    }
    if (settingStr.endsWith(', ')) {
      settingStr = settingStr.replace(/,\s$/, '');
    }
    return settingStr ? ` [${settingStr}]` : '';
  }

  static exportTables (tableIds, model) {
    const tableContentArr = DbmlExporter.getTableContentArr(tableIds, model);

    const tableStrs = tableContentArr.map((tableContent) => {
      const table = model.tables[tableContent.tableId];
      const schema = model.schemas[table.schemaId];
      const tableSettingStr = this.getTableSettings(table);

      let indexStr = '';
      if (!_.isEmpty(tableContent.indexContents)) {
        indexStr = `\nIndexes {\n${tableContent.indexContents.map(indexLine => `  ${indexLine}`).join('\n')}\n}`;
      }

      const tableStr = `Table ${shouldPrintSchema(schema, model)
        ? `"${schema.name}".` : ''}"${table.name}"${tableSettingStr} {\n${
        tableContent.fieldContents.map(line => `  ${line}`).join('\n')}\n${indexStr ? `${indexStr}\n` : ''}}\n`;

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

      let line = 'Ref';
      const refEndpointField = model.fields[refEndpoint.fieldId];
      const refEndpointTable = model.tables[refEndpointField.tableId];
      const refEndpointSchema = model.schemas[refEndpointTable.schemaId];

      if (ref.name) {
        line += ` ${shouldPrintSchema(model.schemas[ref.schemaId], model)
          ? `"${model.schemas[ref.schemaId].name}".` : ''}"${ref.name}"`;
      }
      line += ':';
      line += `${shouldPrintSchema(refEndpointSchema, model)
        ? `"${refEndpointSchema.name}".` : ''}"${refEndpointTable.name}"."${refEndpointField.name}" `;

      const foreignEndpointField = model.fields[foreignEndpoint.fieldId];
      const foreignEndpointTable = model.tables[foreignEndpointField.tableId];
      const foreignEndpointSchema = model.schemas[foreignEndpointTable.schemaId];

      if (foreignEndpoint.relation === '1') line += '- ';
      else line += '< ';
      line += `${shouldPrintSchema(foreignEndpointSchema, model)
        ? `"${foreignEndpointSchema.name}".` : ''}"${foreignEndpointTable.name}"."${foreignEndpointField.name}"`;

      const refActions = [];
      if (ref.onUpdate) {
        refActions.push(`update: ${ref.onUpdate.toLowerCase()}`);
      }
      if (ref.onDelete) {
        refActions.push(`delete: ${ref.onDelete.toLowerCase()}`);
      }
      if (refActions.length > 0) {
        line += ` [${refActions.join(', ')}]`;
      }
      line += '\n';

      return line;
    });

    return strArr.length ? strArr.join('\n') : '';
  }

  static exportTableGroups (tableGroupIds, model) {
    const tableGroupStrs = tableGroupIds.map(groupId => {
      const group = model.tableGroups[groupId];
      const groupSchema = model.schemas[group.schemaId];

      return `TableGroup ${shouldPrintSchema(groupSchema, model)
        ? `"${groupSchema.name}".` : ''}"${group.name}" {\n${
        group.tableIds.map(tableId => {
          const table = model.tables[tableId];
          const tableSchema = model.schemas[table.schemaId];
          return `  ${shouldPrintSchema(tableSchema, model)
            ? `"${tableSchema.name}".` : ''}"${table.name}"`;
        }).join('\n')}\n}\n`;
    });

    return tableGroupStrs.length ? tableGroupStrs.join('\n') : '';
  }

  static export (model) {
    let res = '';
    let hasBlockAbove = false;
    const database = model.database['1'];

    database.schemaIds.forEach((schemaId) => {
      const { enumIds, tableIds, tableGroupIds, refIds } = model.schemas[schemaId];

      if (!_.isEmpty(enumIds)) {
        if (hasBlockAbove) res += '\n';
        res += DbmlExporter.exportEnums(enumIds, model);
        hasBlockAbove = true;
      }

      if (!_.isEmpty(tableIds)) {
        if (hasBlockAbove) res += '\n';
        res += DbmlExporter.exportTables(tableIds, model);
        hasBlockAbove = true;
      }

      if (!_.isEmpty(tableGroupIds)) {
        if (hasBlockAbove) res += '\n';
        res += DbmlExporter.exportTableGroups(tableGroupIds, model);
        hasBlockAbove = true;
      }

      if (!_.isEmpty(refIds)) {
        if (hasBlockAbove) res += '\n';
        res += DbmlExporter.exportRefs(refIds, model);
        hasBlockAbove = true;
      }
    });
    return res;
  }
}

export default DbmlExporter;
