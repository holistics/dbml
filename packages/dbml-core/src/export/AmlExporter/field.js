import { hasWhiteSpace } from '../utils';
import { DEFAULT_SCHEMA_NAME } from '../../model_structure/config';

const TYPE = new Map();
TYPE.set('int', 'number');
TYPE.set('integer', 'number');
TYPE.set('number', 'number');
TYPE.set('date', 'date');
TYPE.set('datetime', 'datetime');
TYPE.set('timestamp', 'datetime');
TYPE.set('truefalse', 'truefalse');
TYPE.set('bool', 'truefalse');
TYPE.set('boolean', 'truefalse');


export function getFieldLines (tableId, model) {
  const table = model.tables[tableId];

  const lines = table.fieldIds.map((fieldId) => {
    const field = model.fields[fieldId];
    let schemaName = '';
    if (field.type.schemaName && field.type.schemaName !== DEFAULT_SCHEMA_NAME) {
      schemaName = hasWhiteSpace(field.type.schemaName) ? `"${field.type.schemaName}".` : `${field.type.schemaName}.`;
    }
    const typeName = hasWhiteSpace(field.type.type_name) ? `"${field.type.type_name}"` : field.type.type_name;
    let line = `  dimension ${field.name} {\n`;
    line += `    lable: '${field.name}'\n`;
    if (field.note) line += `    description: '${field.note}'\n`;
    line += `    type: '${schemaName}${typeName}'\n  }`;
    return line;
  });

  return lines;
}
