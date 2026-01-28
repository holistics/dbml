import { groupBy, isEmpty, reduce } from 'lodash';
import { addDoubleQuoteIfNeeded, formatRecordValue } from '@dbml/parse';
import { shouldPrintSchema } from './utils';
import { DEFAULT_SCHEMA_NAME } from '../model_structure/config';

class DbmlExporter {
  static hasWhiteSpace (str) {
    return /\s/g.test(str);
  }

  static hasSquareBracket (str) {
    return /\[|\]/.test(str);
  }

  static isExpression (str) {
    return /\s*(\*|\+|-|\([A-Za-z0-9_]+\)|\(\))/g.test(str);
  }

  static escapeNote (str) {
    if (str === null) {
      return '';
    }
    let newStr = str.replaceAll('\\', '\\\\');
    if (!newStr.match(/[\n\r']/)) {
      // Only safe chars, no simple quotes nor CR/LF
      return `'${newStr}'`;
    }
    newStr = newStr.replaceAll('\'', '\\\'');
    newStr = newStr.replaceAll('\r\n', '\n'); // turn all CRLF to LF
    return `'''${newStr}'''`;
  }

  static exportEnums (enumIds, model) {
    const enumStrs = enumIds.map((enumId) => {
      const _enum = model.enums[enumId];
      const schema = model.schemas[_enum.schemaId];

      return `Enum ${shouldPrintSchema(schema, model)
        ? `"${schema.name}".`
        : ''}"${_enum.name}" {\n${
        _enum.valueIds.map((valueId) => `  "${model.enumValues[valueId].name}"${model.enumValues[valueId].note
          ? ` [note: ${DbmlExporter.escapeNote(model.enumValues[valueId].note)}]`
          : ''}`).join('\n')}\n}\n`;
    });

    return enumStrs.length ? enumStrs.join('\n') : '';
  }

  static getFieldLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.fieldIds.map((fieldId) => {
      const field = model.fields[fieldId];

      let schemaName = '';
      if (field.type.schemaName && field.type.schemaName !== DEFAULT_SCHEMA_NAME) {
        schemaName = DbmlExporter.hasWhiteSpace(field.type.schemaName) ? `"${field.type.schemaName}".` : `${field.type.schemaName}.`;
      }

      let line = `"${field.name}" ${schemaName}${DbmlExporter.hasWhiteSpace(field.type.type_name) || DbmlExporter.hasSquareBracket(field.type.type_name)
        ? `"${field.type.type_name}"`
        : field.type.type_name}`;

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
      if (field.checkIds) {
        constraints.push(...field.checkIds.map((id) => `check: \`${model.checks[id].expression}\``));
      }
      if (field.dbdefault) {
        let value = 'default: ';
        switch (field.dbdefault.type) {
          case 'boolean':
          case 'number':
            value += `${field.dbdefault.value}`;
            break;

          case 'string': {
            const quote = field.dbdefault.value.includes('\n') ? '\'\'\'' : '\'';
            value += `${quote}${field.dbdefault.value}${quote}`;
            break;
          }

          case 'expression':
            value += `\`${field.dbdefault.value}\``;
            break;

          default:
            value += `\`${field.dbdefault.value}\``;
            break;
        }
        constraints.push(value);
      }
      if (field.note) {
        constraints.push(`note: ${DbmlExporter.escapeNote(field.note)}`);
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
          ? `\`${column.value}\``
          : column.value;
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

  static getCheckLines (tableId, model) {
    const table = model.tables[tableId];

    const lines = table.checkIds.map((checkId) => {
      let line = '';
      const { expression, name } = model.checks[checkId];
      line += `\`${expression}\``;
      if (name) {
        line += ` [name: '${name}']`;
      }
      return line;
    });

    return lines;
  }

  static getTableContentArr (tableIds, model) {
    const tableContentArr = tableIds.map((tableId) => {
      const fieldContents = DbmlExporter.getFieldLines(tableId, model);
      const checkContents = DbmlExporter.getCheckLines(tableId, model);
      const indexContents = DbmlExporter.getIndexLines(tableId, model);

      return {
        tableId,
        fieldContents,
        checkContents,
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
      const tableSettingStr = DbmlExporter.getTableSettings(table);
      // Include schema name if needed
      let tableName = `"${table.name}"`;
      if (shouldPrintSchema(schema, model)) tableName = `"${schema.name}"."${table.name}"`;

      // Include alias if present
      const aliasStr = table.alias ? ` as ${addDoubleQuoteIfNeeded(table.alias)}` : '';

      const fieldStr = tableContent.fieldContents.map((field) => `  ${field}\n`).join('');

      let checkStr = '';
      if (!isEmpty(tableContent.checkContents)) {
        const checkBody = tableContent.checkContents.map((checkLine) => `    ${checkLine}\n`).join('');
        checkStr = `\n  Checks {\n${checkBody}  }\n`;
      }

      let indexStr = '';
      if (!isEmpty(tableContent.indexContents)) {
        const indexBody = tableContent.indexContents.map((indexLine) => `    ${indexLine}\n`).join('');
        indexStr = `\n  Indexes {\n${indexBody}  }\n`;
      }

      const noteStr = table.note ? `  Note: ${DbmlExporter.escapeNote(table.note)}\n` : '';

      return `Table ${tableName}${aliasStr}${tableSettingStr} {\n${fieldStr}${checkStr}${indexStr}${noteStr}}\n`;
    });

    return tableStrs.length ? tableStrs.join('\n') : '';
  }

  static buildFieldName (fieldIds, model) {
    const fieldNames = fieldIds.map((fieldId) => `"${model.fields[fieldId].name}"`).join(', ');
    return fieldIds.length === 1 ? fieldNames : `(${fieldNames})`;
  }

  static exportRefs (refIds, model) {
    const strArr = refIds.map((refId) => {
      const ref = model.refs[refId];
      const oneRelationEndpointIndex = ref.endpointIds.findIndex((endpointId) => model.endpoints[endpointId].relation === '1');
      const isManyToMany = oneRelationEndpointIndex === -1;
      const refEndpointIndex = isManyToMany ? 0 : oneRelationEndpointIndex;
      const foreignEndpointId = ref.endpointIds[1 - refEndpointIndex];
      const refEndpointId = ref.endpointIds[refEndpointIndex];
      const foreignEndpoint = model.endpoints[foreignEndpointId];
      const refEndpoint = model.endpoints[refEndpointId];

      let line = 'Ref';
      const refEndpointField = model.fields[refEndpoint.fieldIds[0]];
      const refEndpointTable = model.tables[refEndpointField.tableId];
      const refEndpointSchema = model.schemas[refEndpointTable.schemaId];
      const refEndpointFieldName = this.buildFieldName(refEndpoint.fieldIds, model, 'dbml');

      if (ref.name) {
        line += ` ${shouldPrintSchema(model.schemas[ref.schemaId], model)
          ? `"${model.schemas[ref.schemaId].name}".`
          : ''}"${ref.name}"`;
      }
      line += ':';
      line += `${shouldPrintSchema(refEndpointSchema, model)
        ? `"${refEndpointSchema.name}".`
        : ''}"${refEndpointTable.name}".${refEndpointFieldName} `;

      const foreignEndpointField = model.fields[foreignEndpoint.fieldIds[0]];
      const foreignEndpointTable = model.tables[foreignEndpointField.tableId];
      const foreignEndpointSchema = model.schemas[foreignEndpointTable.schemaId];
      const foreignEndpointFieldName = this.buildFieldName(foreignEndpoint.fieldIds, model, 'dbml');

      if (isManyToMany) line += '<> ';
      else
        if (foreignEndpoint.relation === '1') line += '- ';
        else line += '< ';
      line += `${shouldPrintSchema(foreignEndpointSchema, model)
        ? `"${foreignEndpointSchema.name}".`
        : ''}"${foreignEndpointTable.name}".${foreignEndpointFieldName}`;

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

  static getTableGroupSettings (tableGroup) {
    const settings = [];

    if (tableGroup.color) settings.push(`color: ${tableGroup.color}`);

    return settings.length ? ` [${settings.join(', ')}]` : '';
  }

  static exportTableGroups (tableGroupIds, model) {
    const tableGroupStrs = tableGroupIds.map((groupId) => {
      const group = model.tableGroups[groupId];
      const groupSchema = model.schemas[group.schemaId];
      const groupSettingStr = DbmlExporter.getTableGroupSettings(group);

      const groupNote = group.note ? `  Note: ${DbmlExporter.escapeNote(group.note)}\n` : '';
      const groupSchemaName = shouldPrintSchema(groupSchema, model) ? `"${groupSchema.name}".` : '';
      const groupName = `${groupSchemaName}"${group.name}"`;

      const tableNames = group.tableIds
        .reduce((result, tableId) => {
          const table = model.tables[tableId];
          const tableSchema = model.schemas[table.schemaId];
          const tableName = `  ${shouldPrintSchema(tableSchema, model) ? `"${tableSchema.name}".` : ''}"${table.name}"`;
          return `${result}${tableName}\n`;
        }, '');

      return `TableGroup ${groupName}${groupSettingStr} {\n${tableNames}${groupNote}}\n`;
    });

    return tableGroupStrs.length ? tableGroupStrs.join('\n') : '';
  }

  static exportStickyNotes (model) {
    return reduce(model.notes, (result, note) => {
      const escapedContent = `  ${DbmlExporter.escapeNote(note.content)}`;
      const stickyNote = `Note ${note.name} {\n${escapedContent}\n}\n`;

      // Add a blank line between note elements
      return result ? `${result}\n${stickyNote}` : stickyNote;
    }, '');
  }

  static exportRecords (model) {
    const records = model.records;
    if (!records || isEmpty(records)) {
      return '';
    }

    // Group records by schemaName and tableName
    const recordGroups = groupBy(Object.values(records), (record) => `${record.schemaName || ''}.${record.tableName}`);

    // Process each group
    const recordStrs = Object.values(recordGroups).map((groupRecords) => {
      const { schemaName, tableName } = groupRecords[0];

      // Build table reference
      const tableRef = schemaName
        ? `${addDoubleQuoteIfNeeded(schemaName)}.${addDoubleQuoteIfNeeded(tableName)}`
        : addDoubleQuoteIfNeeded(tableName);

      // Collect all unique columns in order
      const allColumns = [...new Set(groupRecords.flatMap((r) => r.columns))];
      const columnList = allColumns.map(addDoubleQuoteIfNeeded).join(', ');

      // Merge all rows
      const allRows = groupRecords.flatMap((record) => {
        const allColumnIndexes = allColumns.map((col) => record.columns.indexOf(col));
        return record.values.map((row) => allColumnIndexes.map((colIdx) => colIdx === -1 ? { value: null, type: 'expression' } : row[colIdx]));
      });

      // Build data rows
      const rowStrs = allRows.map((row) =>
        `  ${row.map(formatRecordValue).join(', ')}`,
      );

      return `records ${tableRef}(${columnList}) {\n${rowStrs.join('\n')}\n}\n`;
    });

    return recordStrs.join('\n');
  }

  static export (model) {
    const elementStrs = [];
    const database = model.database['1'];

    database.schemaIds.forEach((schemaId) => {
      const {
        enumIds, tableIds, tableGroupIds, refIds,
      } = model.schemas[schemaId];

      if (!isEmpty(enumIds)) elementStrs.push(DbmlExporter.exportEnums(enumIds, model));
      if (!isEmpty(tableIds)) elementStrs.push(DbmlExporter.exportTables(tableIds, model));
      if (!isEmpty(tableGroupIds)) elementStrs.push(DbmlExporter.exportTableGroups(tableGroupIds, model));
      if (!isEmpty(refIds)) elementStrs.push(DbmlExporter.exportRefs(refIds, model));
    });

    if (!isEmpty(model.notes)) elementStrs.push(DbmlExporter.exportStickyNotes(model));
    if (!isEmpty(model.records)) elementStrs.push(DbmlExporter.exportRecords(model));

    // all elements already end with 1 '\n', so join('\n') to separate them with 1 blank line
    return elementStrs.join('\n');
  }
}

export default DbmlExporter;
