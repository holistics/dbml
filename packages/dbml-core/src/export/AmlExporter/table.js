import { shouldPrintSchema } from '../utils';
import { getFieldLines } from './exportField';


export function getTableContentArr (tableIds, model) {
  const tableContentArr = tableIds.map((tableId) => {
    const fieldContents = getFieldLines(tableId, model);
    return {
      tableId,
      fieldContents,
    };
  });

  return tableContentArr;
}

export function exportTables (tableIds, model, dataSource) {
  const tableContentArr = getTableContentArr(tableIds, model);

  const tableStrs = tableContentArr.map((tableContent) => {
    const content = [...tableContent.fieldContents];
    const table = model.tables[tableContent.tableId];
    const schema = model.schemas[table.schemaId];
    const nameTable = `${shouldPrintSchema(schema, model) ? `${schema.name}.` : 'public'}_${table.name}`;
    let tableStr = ` Model ${nameTable}_${table.name} {\n`;
    tableStr += '  type: \'table\'\n';
    tableStr += `  label: "${table.name}"\n`;
    tableStr += `  description: ${table.note ? `'${table.note}'` : ''}\n`;
    tableStr += `  data_source_name: \'${dataSource}\'\n`;
    tableStr += `${content.map(line => `  ${line}`).join('\n')}\n}\n\n\n`;
    return { nameTable, tableStr };
  });
  return tableStrs;
}
