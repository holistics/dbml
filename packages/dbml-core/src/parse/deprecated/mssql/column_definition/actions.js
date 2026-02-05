import { last } from 'lodash-es';

function makeDataType(typeName, args) {
  const argsString = args ? args.join(',') : null;
  return {
    type: 'type',
    value: {
      type_name: !argsString ? last(typeName) : `${last(typeName)}(${argsString})`,
      schemaName: typeName.length > 1 ? typeName[0] : null,
      args: argsString,
    },
  };
}

function makeColumn(fieldName, dataType, fieldSettings) {
  const value = {};
  value[dataType.type] = dataType.value;
  fieldSettings.forEach((setting) => {
    if (setting) value[setting.type] = setting.value;
  });
  value.name = fieldName[0];
  if (!value.inline_refs) value.inline_refs = [];
  return {
    type: 'fields',
    value,
  };
}

export {
  makeColumn,
  makeDataType,
};
