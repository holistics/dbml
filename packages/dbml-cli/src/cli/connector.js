import { importer } from '@dbml/core';
import { connector } from '@dbml/connector';
import figures from 'figures';
import chalk from 'chalk';
import path from 'path';
import {
  resolvePaths,
  getConnectionOpt,
} from './utils';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import logger from '../helpers/logger';

export default async function connectionHandler (program) {
  try {
    const { connection, databaseType } = getConnectionOpt(program.args);
    const opts = program.opts();
    const schemaJson = await connector.fetchSchemaJson(connection, databaseType);

    if (!opts.outFile && !opts.outDir) {
      const res = importer.generateDbml(schemaJson);
      OutputConsolePlugin.write(res);
    } else if (opts.outFile) {
      const res = importer.generateDbml(schemaJson);
      (new OutputFilePlugin(resolvePaths(opts.outFile))).write(res);

      // bearer:disable javascript_lang_logger
      console.log(`  ${chalk.green(figures.main.tick)} Generated DBML file from database's connection: ${path.basename(opts.outFile)}`);
    }
  } catch (error) {
    logger.error(error);
  }
}
