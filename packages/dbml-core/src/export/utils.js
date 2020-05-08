import { DEFAULT_SCHEMA_NAME } from '../model_structure/config';

export function hasWhiteSpace (s) {
  return /\s/g.test(s);
}

export function shouldPrintSchema (schema, model) {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && model.database['1'].hasDefaultSchema);
}
export function buildFieldName (fieldIds, model, format) {
  let encloserLeft = '"', encloserRight = '"';
  let parenthesis = true;
  switch (format){
    case "mysql":
      encloserLeft = '`';
      encloserRight = '`';
      break;
    case "mssql":
      encloserLeft = '[';
      encloserRight = ']';
      break;
    case "dbml":
      parenthesis = false;
      break;
  }
  let fieldNames = fieldIds.map(fieldId => encloserLeft + model.fields[fieldId].name + encloserRight);
  return fieldIds.length == 1 ? (parenthesis ? `(${fieldNames.join("")})` : fieldNames.join("")) 
                              : `(${fieldNames.join(", ")})`;
}
