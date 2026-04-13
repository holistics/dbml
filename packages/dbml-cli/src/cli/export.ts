import figures from 'figures';
import chalk from 'chalk';
import path from 'path';
import {
  exporter, CompilerError,
} from '@dbml/core';
import type {
  ExportFormat,
} from '@dbml/core';
import {
  validateInputFilePaths,
  resolvePaths,
  getFormatOpt,
  generate,
} from './utils';
import {
  validateFilePlugin,
} from './validatePlugins/validatePlugins';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import config from './config';
import logger from '../helpers/logger';
import {
  SyntaxError,
} from '../errors';

interface Program {
  args: string[];
  opts(): Record<string, unknown>;
}

export default async function exportHandler (program: Program) {
  try {
    const inputPaths = resolvePaths(program.args) as string[];
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
