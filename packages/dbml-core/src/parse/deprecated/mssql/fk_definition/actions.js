import { getFullTableName } from '../utils.js';

function makeEndPoint(tableName, columnName, relation) {
  return {
    tableName: tableName.name,
    schemaName: tableName.schemaName,
    fieldNames: columnName,
    relation,
  };
}

function setOption(value, fkOptions) {
  fkOptions.forEach((option) => {
    if (option.type.match(/ON[^\S\r\n]DELETE/i)) {
      value.onDelete = option.setting;
    }
    if (option.type.match(/ON[^\S\r\n]UPDATE/i)) {
      value.onUpdate = option.setting;
    }
  });
}

function makeColumnConstraintFK(_unused, tableName, columnName, fkOptions) {
  const value = {};
  const fullTableName = getFullTableName(tableName);

  value.endpoint = makeEndPoint(fullTableName, columnName, '1');
  setOption(value, fkOptions);
  return {
    type: 'inline_refs',
    value: [value],
  };
}

function makeTableEndpoint(columnNames) {
  return {
    type: 'endpoint',
    value: {
      fieldNames: columnNames,
    },
  };
}

function makeTableConstraintFK(_keyword1, endpoint1, _keyword2, tableName, endpoint2, fkOptions) {
  const value = {};
  const fullTableName = getFullTableName(tableName);

  if (!endpoint2) {
    // Omits columns list, see: https://docs.microsoft.com/en-us/sql/t-sql/statements/create-table-transact-sql?view=sql-server-ver16#foreign-key-constraints

    endpoint2 = {
      type: 'endpoint',
      value: {
        fieldNames: null,
      },
    };
  }

  endpoint1.value.relation = '*';
  endpoint2.value.relation = '1';
  endpoint2.value.tableName = fullTableName.name;
  endpoint2.value.schemaName = fullTableName.schemaName;

  value.endpoints = [endpoint1.value, endpoint2.value];
  setOption(value, fkOptions);

  return {
    type: 'refs',
    value,
  };
}

function makeOnSetting(type, setting) {
  return {
    type,
    setting: setting.toLowerCase().trim().split(/[ ]+/).join(' '),
  };
}

export {
  makeOnSetting,
  makeColumnConstraintFK,
  makeTableConstraintFK,
  makeTableEndpoint,
};
