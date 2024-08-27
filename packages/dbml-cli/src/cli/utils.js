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

function getConnectionOpt (args) {
  const supportedDatabases = ['postgres', 'mysql', 'mssql', 'snowflake', 'bigquery'];
  const defaultConnectionOpt = {
    connection: args[0],
    databaseType: 'unknown',
  };

  return reduce(args, (connectionOpt, arg) => {
    if (supportedDatabases.includes(arg)) connectionOpt.databaseType = arg;
    // Check if the arg is a connection string using regex
    const connectionStringRegex = /^.*[:;]/;
    if (connectionStringRegex.test(arg)) {
      // Example: jdbc:mysql://localhost:3306/mydatabase
      // Example: odbc:Driver={SQL Server};Server=myServerAddress;Database=myDataBase;Uid=myUsername;Pwd=myPassword;
      connectionOpt.connection = arg;
    }

    const windowFilepathRegex = /^[a-zA-Z]:[\\/](?:[^<>:"/\\|?*\n\r]+[\\/])*[^<>:"/\\|?*\n\r]*$/;
    const unixFilepathRegex = /^(\/|\.\/|~\/|\.\.\/)([^<>:"|?*\n\r]*\/?)*[^<>:"|?*\n\r]*$/;

    if (windowFilepathRegex.test(arg) || unixFilepathRegex.test(arg)) {
      connectionOpt.connection = arg;
    }

    return connectionOpt;
  }, defaultConnectionOpt);
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
