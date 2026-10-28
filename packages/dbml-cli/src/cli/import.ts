import path from 'path';
import { CompilerDiagnostics, importer } from '@dbml/core';
import type {
  CompilerDiagnostic,
  ImportFormat,
} from '@dbml/core';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { SyntaxError } from '../errors';
import { consoleLogger, fileLogger } from '../helpers/logger';
import config from './config';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import {
  generate,
  getFormatOpt,
  resolvePaths,
  validateInputFilePaths,
} from './utils';
import { validateFilePlugin } from './validatePlugins/validatePlugins';

export default async function importHandler (program: Command) {
  try {
    const inputPaths = resolvePaths(program.args);
    validateInputFilePaths(inputPaths, validateFilePlugin);
    const options = program.opts();

    const format = getFormatOpt(options) as ImportFormat;

    if (!options.outFile && !options.outDir) {
      generate(inputPaths, (sql) => importer.import(sql, format), OutputConsolePlugin);
    } else if (options.outFile) {
      generate(inputPaths, (sql) => importer.import(sql, format), new OutputFilePlugin(resolvePaths(options.outFile)));

      console.log(`  ${chalk.green(figures.main.tick)} Generated DBML file from SQL file (${config[format].name}): ${path.basename(options.outFile)}`);
    }
  } catch (error) {
    if (error instanceof CompilerDiagnostics) {
      const message = `\n    ${error.diags.map((diag: CompilerDiagnostic) => new SyntaxError(diag.filepath ?? '', diag)).map((syntaxError: SyntaxError) => syntaxError.message).join('\n    ')}`;
      consoleLogger.error(message);
      fileLogger.error(message);
      return;
    }
    throw error;
  }
}
