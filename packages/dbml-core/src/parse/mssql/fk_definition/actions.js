const _ = require('lodash');

function makeEndPoint (tableName, columnName, relation) {
  return {
    tableName: tableName[tableName.length - 1],
    fieldNames: columnName,
    relation,
  };
}

function setOption (value, fkOptions) {
  fkOptions.forEach(option => {
    if (option.type.match(/ON[^\S\r\n]DELETE/i)) {
      value.onDelete = option.setting;
    }
    if (option.type.match(/ON[^\S\r\n]UPDATE/i)) {
      value.onUpdate = option.setting;
    }
  });
}

function makeColumnConstraintFK (_unused, tableName, columnName, fkOptions) {
  const value = {};
  value.endpoint = makeEndPoint(tableName, columnName, '1');
  setOption(value, fkOptions);
  return {
    type: 'inline_refs',
    value: [value],
  };
}

function makeTableEndpoint (columnNames) {
  return {
    type: 'endpoint',
    value: {
      fieldNames: columnNames,
    },
  };
}

function makeTableConstraintFK (_keyword1, endpoint1, _keyword2, tableName, endpoint2, fkOptions) {
  const value = {};

  endpoint1.value.relation = '*';
  endpoint2.value.relation = '1';
  endpoint2.value.tableName = _.last(tableName);

  value.endpoints = [endpoint1.value, endpoint2.value];
  setOption(value, fkOptions);

  return {
    type: 'refs',
    value,
  };
}

function makeOnSetting (type, setting) {
  return {
    type,
    setting: setting.toLowerCase().trim().split(/[ ]+/).join(' '),
  };
}

module.exports = {
  makeOnSetting,
  makeColumnConstraintFK,
  makeTableConstraintFK,
  makeTableEndpoint,
};
