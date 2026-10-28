import fs from 'fs';
import path from 'path';
import {
  CompilerDiagnostics,
  type CompilerDiagnostic,
  type ExportFormat,
} from '@dbml/core';
import { reduce } from 'lodash-es';

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

function validateInputFilePaths (paths: string[], validatePlugin: (_path: string) => void) {
  return paths.every((_path) => validatePlugin(_path));
}

function getFormatOpt (options: Record<string, unknown>): ExportFormat {
  const formatOptions = Object.keys(options).filter((opt) => {
    return ['postgres', 'mysql', 'mssql', 'postgresLegacy', 'mysqlLegacy', 'mssqlLegacy', 'oracle', 'snowflake'].includes(opt);
  });

  let format: ExportFormat = 'postgres';
  let cnt = 0;

  formatOptions.forEach((opt) => {
    if (options[opt]) {
      cnt += 1;
      if (cnt > 1) throw new Error('Too many format options');
      format = opt as ExportFormat;
    }
  });

  return format as ExportFormat;
}

function getConnectionOpt (args: string[]): ConnectionOpt {
  const supportedDatabases = ['postgres', 'mysql', 'mssql', 'snowflake', 'bigquery', 'oracle'];
  const defaultConnectionOpt: ConnectionOpt = {
    connection: args[0],
    databaseType: 'unknown',
  };

  return reduce(args, (connectionOpt, argument) => {
    if (supportedDatabases.includes(argument)) connectionOpt.databaseType = argument;
    // Check if the arg is a connection string using regex
    const connectionStringRegex = /^.*[:;]/;
    if (connectionStringRegex.test(argument)) {
      // Example: jdbc:mysql://localhost:3306/mydatabase
      // Example: odbc:Driver={SQL Server};Server=myServerAddress;Database=myDataBase;Uid=myUsername;Pwd=myPassword;
      connectionOpt.connection = argument;
    }

    const windowFilepathRegex = /^[a-zA-Z]:[\\/](?:[^<>:"/\\|?*\n\r]+[\\/])*[^<>:"/\\|?*\n\r]*$/;
    const unixFilepathRegex = /^(\/|\.\/|~\/|\.\.\/)([^<>:"|?*\n\r]*\/?)*[^<>:"|?*\n\r]*$/;

    if (windowFilepathRegex.test(argument) || unixFilepathRegex.test(argument)) {
      connectionOpt.connection = argument;
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
    } catch (error) {
      if (error instanceof CompilerDiagnostics) {
        throw error.map((diag: CompilerDiagnostic) => ({
          ...diag,
          message: diag.message,
          filepath: path.basename(_path),
          stack: diag.stack,
        }));
      }
      throw error;
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
