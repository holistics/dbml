import path from 'path';
import {
  CompilerError, importer,
} from '@dbml/core';
import type {
  ImportFormat,
} from '@dbml/core';
import chalk from 'chalk';
import {
  Command,
} from 'commander';
import figures from 'figures';
import {
  SyntaxError,
} from '../errors';
import {
  consoleLogger, fileLogger,
} from '../helpers/logger';
import config from './config';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import {
  generate,
  getFormatOpt,
  resolvePaths,
  validateInputFilePaths,
} from './utils';
import {
  validateFilePlugin,
} from './validatePlugins/validatePlugins';

export default async function importHandler (program: Command) {
  try {
    const inputPaths = resolvePaths(program.args);
    validateInputFilePaths(inputPaths, validateFilePlugin);
    const opts = program.opts();

    const format = getFormatOpt(opts) as ImportFormat;

    if (!opts.outFile && !opts.outDir) {
      generate(inputPaths, (sql) => importer.import(sql, format), OutputConsolePlugin);
    } else if (opts.outFile) {
      generate(inputPaths, (sql) => importer.import(sql, format), new OutputFilePlugin(resolvePaths(opts.outFile)));

      console.log(`  ${chalk.green(figures.main.tick)} Generated DBML file from SQL file (${config[format].name}): ${path.basename(opts.outFile)}`);
    }
  } catch (error) {
    if (error instanceof CompilerError) {
      const msg = `\n    ${error.diags.map((diag) => new SyntaxError(diag.filepath ?? '', diag)).map(({
        message,
      }) => message).join('\n    ')}`;
      consoleLogger.error(msg);
      fileLogger.error(msg);
      return;
    }
    throw error;
  }
}
