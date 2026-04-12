import {
  importer, CompilerError,
} from '@dbml/core';
import type { ImportFormat } from '@dbml/core';
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
import { SyntaxError } from '../errors';

interface Program {
  args: string[];
  opts(): Record<string, unknown>;
}

export default async function importHandler (program: Program) {
  try {
    const inputPaths = resolvePaths(program.args) as string[];
    validateInputFilePaths(inputPaths, validateFilePlugin);
    const opts = program.opts();

    const format = getFormatOpt(opts) as ImportFormat;

    if (!opts.outFile && !opts.outDir) {
      generate(inputPaths, (sql) => importer.import(sql, format), OutputConsolePlugin);
    } else if (opts.outFile) {
      generate(inputPaths, (sql) => importer.import(sql, format), new OutputFilePlugin(resolvePaths(opts.outFile as string) as string));

      console.log(`  ${chalk.green(figures.main.tick)} Generated DBML file from SQL file (${config[format].name}): ${path.basename(opts.outFile as string)}`);
    }
  } catch (error) {
    if (error instanceof CompilerError) {
      logger.error(`\n    ${error.diags.map((diag) => new SyntaxError(diag.filepath ?? '', diag)).map(({ message }) => message).join('\n    ')}`);
      return;
    }
    throw error;
  }
}
