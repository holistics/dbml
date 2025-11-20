import fs from 'fs';
import path from 'path';
import _ from 'lodash';

/**
 * Scans a directory for test input files matching the pattern `*.in.*`
 * and returns the test names (filenames without the `.in.extension` suffix)
 */
export function scanTestNames (dirname: string, subpath: string): string[] {
  const dirFilepath = path.join(dirname, subpath);
  const files = fs.readdirSync(dirFilepath);

  return files
    .filter((fn) => fn.match(/\.in\./))
    .map((fn) => fn.split('.in.')[0]);
}

export function getFileExtension (format: string): string {
  if (format === 'schemarb') {
    return 'rb';
  }

  const SQL_FORMATS: string[] = ['mysql', 'postgres', 'mssql', 'oracle', 'snowflake'];
  if (SQL_FORMATS.includes(format)) {
    return 'sql';
  }
  return format;
}

function omitDeep (obj: any, predicate: (key: string, value: unknown) => boolean): any {
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

export function isEqualExcludeTokenEmpty (receivedObj: any, sourceObj: any): void {
  const isTokenEmptyProperty = (key: string, value: unknown) => {
    return (
      key === 'token'
      || value === undefined
      || value === null
      || (Array.isArray(value) && _.isEmpty(value))
      || (typeof value === 'object' && _.isEmpty(value))
    );
  };

  const sourceObjExcludeTokenEmpty = omitDeep(sourceObj, isTokenEmptyProperty);
  const receivedObjExludeTokenEmpty = omitDeep(receivedObj, isTokenEmptyProperty);

  expect(receivedObjExludeTokenEmpty).toEqual(sourceObjExcludeTokenEmpty);
}
