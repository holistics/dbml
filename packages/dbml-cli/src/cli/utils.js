import path from 'path';
import fs from 'fs';
import { CompilerError } from '@dbml/core';
import { reduce } from 'lodash';

function resolvePaths (paths) {
  if (!Array.isArray(paths)) {
    return path.resolve(process.cwd(), paths);
  }
  return paths.map((_path) => path.resolve(process.cwd(), _path));
}

function validateInputFilePaths (paths, validatePlugin) {
  return paths.every((_path) => validatePlugin(_path));
}

function getFormatOpt (opts) {
  const formatOpts = Object.keys(opts).filter((opt) => {
    return ['postgres', 'mysql', 'mssql', 'postgresLegacy', 'mysqlLegacy', 'oracle', 'snowflake'].includes(opt);
  });

  let format = 'postgres';
  let cnt = 0;

  formatOpts.forEach((opt) => {
    if (opts[opt]) {
      cnt += 1;
      if (cnt > 1) throw new Error('Too many format options');
      format = opt;
    }
  });

  return format;
}

function getConnectionOpt (opts) {
  const supportedDatabases = ['postgres', 'mysql', 'mssql'];
  const selectedFormat = reduce(opts, (format, value, key) => {
    if (supportedDatabases.includes(key) && value) return key;
    return format;
  }, 'postgres');

  const connection = opts.connectionString ? { connectionString: opts.connectionString } : {
    user: opts.user,
    host: opts.host || 'localhost',
    database: opts.database,
    password: opts.password,
    port: opts.port || '5432',
  };

  return {
    format: selectedFormat,
    connection,
  };
}

function generate (inputPaths, transform, outputPlugin) {
  inputPaths.forEach((_path) => {
    const source = fs.readFileSync(_path, 'utf-8');
    try {
      const content = transform(source);
      outputPlugin.write(content);
    } catch (e) {
      if (e instanceof CompilerError) throw e.map((diag) => ({ ...diag, message: diag.message, filepath: path.basename(_path), stack: diag.stack }));
      throw e;
    }
  });
}

export {
  resolvePaths,
  validateInputFilePaths,
  getFormatOpt,
  getConnectionOpt,
  generate,
};
