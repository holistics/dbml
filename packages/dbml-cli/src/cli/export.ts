import path from 'path';
import {
  ModelExporter, Parser,
} from '@dbml/core';
import {
  Compiler, Filepath,
} from '@dbml/parse';
import chalk from 'chalk';
import type {
  Command,
} from 'commander';
import figures from 'figures';
import {
  NodeProjectLayout,
} from '../NodeProjectLayout';
import logger from '../helpers/logger';
import config from './config';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import {
  getFormatOpt,
  resolvePaths,
  validateInputFilePaths,
} from './utils';
import {
  validateFilePlugin,
} from './validatePlugins/validatePlugins';

export default async function exportHandler (program: Command): Promise<void> {
  const inputPaths = resolvePaths(program.args);
  validateInputFilePaths(inputPaths, validateFilePlugin);
  const opts = program.opts();
  const format = getFormatOpt(opts);

  const entrypoints = inputPaths.map((p: string) => new Filepath(p));
  const compiler = new Compiler(new NodeProjectLayout(entrypoints));

  const outputPlugin = opts.outFile
    ? new OutputFilePlugin(
        resolvePaths(opts.outFile as string),
        [
          '-- SQL dump generated using DBML (dbml.dbdiagram.io)\n',
          `-- Database: ${(config as any)[format].name}\n`,
          `-- Generated at: ${new Date().toISOString()}\n\n`,
        ].join(''),
      )
    : OutputConsolePlugin;

  let hasErrors = false;

  for (const filepath of entrypoints) {
    const result = compiler.interpretFile(filepath);
    const errors = result.getErrors();

    if (errors.length > 0) {
      hasErrors = true;
      const isMultifile = compiler.reachableFiles(filepath).length > 1; // If this filepath can reach other files, it's mutifile
      logger.error(
        `\n    ${errors
          .map((e) => {
            const pos = e.nodeOrToken.startPos;
            const line = pos.line + 1;
            const col = pos.column + 1;
            const location = chalk.cyan(isMultifile ? e.filepath.relativeTo(process.cwd()) : e.filepath.basename);
            const position = chalk.yellow(`(${line},${col})`);
            return `${location}${position}: ${e.message}`;
          })
          .join('\n    ')}`,
      );
      continue;
    }

    const db = result.getValue();
    if (!db) continue;

    const sql = ModelExporter.export(Parser.parseJSONToDatabase(db as any), format);
    outputPlugin.write(sql);
  }

  if (!hasErrors && opts.outFile) {
    console.log(`  ${chalk.green(figures.main.tick)} Generated SQL dump file (${(config as any)[format].name}): ${path.basename(opts.outFile)}`);
  }
}
