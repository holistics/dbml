import path from 'path';
import fs from 'fs';
import {
  type ExportFormat,
} from '@dbml/core';
import {
  reduce,
} from 'lodash-es';

interface OutputPlugin {
  write(content: string): void;
}

interface ConnectionOpt {
  connection: string;
  databaseType: string;
}

function resolvePaths (paths: string): string;
function resolvePaths (paths: string[]): string[];
function resolvePaths (paths: string | string[]): string | string[] {
  if (!Array.isArray(paths)) {
    return path.resolve(process.cwd(), paths);
  }
  return paths.map((_path) => path.resolve(process.cwd(), _path));
}

function validateInputFilePaths (paths: string[], validatePlugin: (p: string) => void): void {
  paths.forEach((_path) => validatePlugin(_path));
}

function getFormatOpt (opts: Record<string, unknown>): ExportFormat {
  const formatOpts = Object.keys(opts).filter((opt) => {
    return ['postgres', 'mysql', 'mssql', 'postgresLegacy', 'mysqlLegacy', 'mssqlLegacy', 'oracle', 'snowflake'].includes(opt);
  });

  let format: ExportFormat = 'postgres';
  let cnt = 0;

  formatOpts.forEach((opt) => {
    if (opts[opt]) {
      cnt += 1;
      if (cnt > 1) throw new Error('Too many format options');
      format = opt as ExportFormat;
    }
  });

  return format;
}

function getConnectionOpt (args: string[]): { connection: string;
  databaseType: string; } {
  const supportedDatabases = ['postgres', 'mysql', 'mssql', 'snowflake', 'bigquery', 'oracle'];
  const defaultConnectionOpt: ConnectionOpt = {
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

function generate (
  inputPaths: string[],
  transform: (source: string) => string,
  outputPlugin: OutputPlugin,
): void {
  inputPaths.forEach((_path) => {
    const source = fs.readFileSync(_path, 'utf-8');
    try {
      const content = transform(source);
      outputPlugin.write(content);
    } catch (e: any) {
      if (e && typeof e.map === 'function') {
        throw e.map((diag: any) => ({
          ...diag,
          message: diag.message,
          filepath: path.basename(_path),
          stack: diag.stack,
        }));
      }
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
