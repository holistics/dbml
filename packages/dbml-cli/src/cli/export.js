import figures from 'figures';
import chalk from 'chalk';
import path from 'path';
import { Parser, ModelExporter, Filepath } from '@dbml/core';
import NodeProjectLayout from '../helpers/NodeProjectLayout';
import {
  validateInputFilePaths,
  resolvePaths,
  getFormatOpt,
} from './utils';
import { validateFilePlugin } from './validatePlugins/validatePlugins';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import config from './config';
import logger from '../helpers/logger';
import { SyntaxError } from '../errors';

export default async function exportHandler (program) {
  try {
    const inputPaths = resolvePaths(program.args);
    validateInputFilePaths(inputPaths, validateFilePlugin);
    const opts = program.opts();
    const format = getFormatOpt(opts);

    const entryPoints = inputPaths.map((p) => Filepath.from(p));
    const layout = new NodeProjectLayout(entryPoints);
    const database = Parser.parseProject(layout, entryPoints[0], 'dbmlv2');
    const content = ModelExporter.export(database, format);

    if (!opts.outFile && !opts.outDir) {
      OutputConsolePlugin.write(content);
    } else if (opts.outFile) {
      const header = [
        '-- SQL dump generated using DBML (dbml.dbdiagram.io)\n',
        `-- Database: ${config[format].name}\n`,
        `-- Generated at: ${new Date().toISOString()}\n\n`,
      ].join('');

      new OutputFilePlugin(resolvePaths(opts.outFile), header).write(content);

      console.log(`  ${chalk.green(figures.main.tick)} Generated SQL dump file (${config[format].name}): ${path.basename(opts.outFile)}`);
    }
  } catch (error) {
    logger.error(`\n    ${error.diags.map((diag) => new SyntaxError(diag.filepath, diag)).map(({ message }) => message).join('\n    ')}`);
  }
}
