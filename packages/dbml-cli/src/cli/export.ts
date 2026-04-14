import path from 'path';
import {
  CompilerError, exporter,
} from '@dbml/core';
import type {
  ExportFormat,
} from '@dbml/core';
import chalk from 'chalk';
import type {
  Command,
} from 'commander';
import figures from 'figures';
import {
  SyntaxError,
} from '../errors';
import logger from '../helpers/logger';
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

export default async function exportHandler (program: Command) {
  try {
    const inputPaths = resolvePaths(program.args);
    validateInputFilePaths(inputPaths, validateFilePlugin);
    const opts = program.opts();

    const format = getFormatOpt(opts) as ExportFormat;

    if (!opts.outFile && !opts.outDir) {
      generate(inputPaths, (dbml) => exporter.export(dbml, format), OutputConsolePlugin);
    } else if (opts.outFile) {
      const header = [
        '-- SQL dump generated using DBML (dbml.dbdiagram.io)\n',
        `-- Database: ${config[format].name}\n`,
        `-- Generated at: ${new Date().toISOString()}\n\n`,
      ].join('');

      generate(
        inputPaths,
        (dbml) => exporter.export(dbml, format),
        new OutputFilePlugin(resolvePaths(opts.outFile as string) as string, header),
      );

      console.log(`  ${chalk.green(figures.main.tick)} Generated SQL dump file (${config[format].name}): ${path.basename(opts.outFile as string)}`);
    }
  } catch (error) {
    const e = error as CompilerError;
    logger.error(`\n    ${e.diags.map((diag) => new SyntaxError(diag.filepath ?? '', diag)).map(({
      message,
    }) => message).join('\n    ')}`);
  }
}
