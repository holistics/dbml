import path from 'path';
import {
  connector,
} from '@dbml/connector';
import {
  importer,
} from '@dbml/core';
import chalk from 'chalk';
import {
  Command,
} from 'commander';
import figures from 'figures';
import logger from '../helpers/logger';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import {
  getConnectionOpt,
  resolvePaths,
} from './utils';

export default async function connectionHandler (program: Command) {
  try {
    const {
      connection, databaseType,
    } = getConnectionOpt(program.args);
    const opts = program.opts();
    const schemaJson = await connector.fetchSchemaJson(connection, databaseType);

    if (!opts.outFile && !opts.outDir) {
      const res = importer.generateDbml(schemaJson);
      OutputConsolePlugin.write(res);
    } else if (opts.outFile) {
      const res = importer.generateDbml(schemaJson);
      (new OutputFilePlugin(resolvePaths(opts.outFile))).write(res);

      // bearer:disable javascript_lang_logger
      console.log(`  ${chalk.green(figures.main.tick)} Generated DBML file from database's connection: ${path.basename(opts.outFile as string)}`);
    }
  } catch (error) {
    logger.error(error);
  }
}
