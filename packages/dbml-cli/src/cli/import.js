import { importer } from '@dbml/core';
import figures from 'figures';
import chalk from 'chalk';
import path from 'path';
import config from './config';
import {
  validateInputFilePaths,
  resolvePaths,
  getFormatOpt,
  generate,
} from './utils';
import { validateFilePlugin } from './validatePlugins/validatePlugins';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import logger from '../helpers/logger';

export default async function importHandler (program) {
  try {
    const inputPaths = resolvePaths(program.args);
    validateInputFilePaths(inputPaths, validateFilePlugin);
    const opts = program.opts();

    const format = getFormatOpt(opts);

    if (!opts.outFile && !opts.outDir) {
      generate(inputPaths, (sql) => importer.import(sql, format), OutputConsolePlugin);
    } else if (opts.outFile) {
      generate(inputPaths, (sql) => importer.import(sql, format),
        new OutputFilePlugin(resolvePaths(opts.outFile)));

      console.log(`  ${chalk.green(figures.tick)} Generated DBML file from SQL file (${config[format].name}): ${path.basename(opts.outFile)}`);
    }
  } catch (err) {
    logger.error(err);
  }
}
