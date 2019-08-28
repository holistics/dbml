import figures from 'figures';
import chalk from 'chalk';
import path from 'path';
import { exporter } from '@dbml/core';
import {
  validateInputFilePaths,
  resolvePaths,
  getFormatOpt,
  generate,
} from './utils';
import { validateFilePlugin } from './validatePlugins/validatePlugins';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import config from './config';
import logger from '../helpers/logger';

export default async function exportHandler (program) {
  try {
    const inputPaths = resolvePaths(program.args);
    validateInputFilePaths(inputPaths, validateFilePlugin);
    const opts = program.opts();

    const format = getFormatOpt(opts);

    if (!opts.outFile && !opts.outDir) {
      generate(inputPaths, (dbml) => exporter.export(dbml, format), OutputConsolePlugin);
    } else if (opts.outFile) {
      const header = [
        '-- SQL dump generated using DBML (dbml-lang.org)\n',
        `-- Database: ${config[format].name}\n`,
        `-- Generated at: ${new Date().toISOString()}\n\n`,
      ].join('');

      generate(inputPaths, (dbml) => exporter.export(dbml, format),
        new OutputFilePlugin(resolvePaths(opts.outFile), header));

      console.log(`  ${chalk.green(figures.tick)} Generated SQL dump file (${config[format].name}): ${path.basename(opts.outFile)}`);
    }
  } catch (err) {
    logger.error(err);
  }
}
