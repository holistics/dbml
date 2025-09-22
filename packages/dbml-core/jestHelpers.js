const fs = require('fs');
const path = require('path');
const _ = require('lodash');

global.scanTestNames = (dirname, subpath) => {
  const dirFilepath = path.join(dirname, subpath);
  const files = fs.readdirSync(dirFilepath);

  return files.filter((fn) => {
    return fn.match(/\.in\./);
  }).map(fn => fn.split('.in.')[0]);
};

global.getFileExtension = (format) => {
  if (format === 'schemarb') {
    return 'rb';
  }

  const SQL_FORMATS = ['mysql', 'postgres', 'mssql', 'oracle', 'snowflake', 'sqlite'];
  if (SQL_FORMATS.includes(format)) {
    return 'sql';
  }
  return format;
};

function omitDeep (obj, predicate) {
  _.forIn(obj, (value, key) => {
    if (predicate(key, value)) {
      delete obj[key];
      return;
    }
    if (_.isObject(value)) {
      obj[key] = omitDeep(value, predicate);
    }
  });
  return obj;
}

global.isEqualExcludeTokenEmpty = (receivedObj, sourceObj) => {
  const isTokenEmptyProperty = (key, value) => {
    return key === 'token' || value === undefined || value === null
      || (Array.isArray(value) && _.isEmpty(value)) || (typeof value === 'object' && _.isEmpty(value));
  };

  const sourceObjExcludeTokenEmpty = omitDeep(sourceObj, isTokenEmptyProperty);
  const receivedObjExludeTokenEmpty = omitDeep(receivedObj, isTokenEmptyProperty);

  expect(receivedObjExludeTokenEmpty).toEqual(sourceObjExcludeTokenEmpty);
};
