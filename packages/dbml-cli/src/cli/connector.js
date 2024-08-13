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
    const { connection, format } = getConnectionOpt(program.args);
    const opts = program.opts();
    const schemaJson = await connector.fetchSchemaJson(connection, format);

    if (!opts.outFile && !opts.outDir) {
      const res = await importer.generateDbml(schemaJson);
      OutputConsolePlugin.write(res);
    } else if (opts.outFile) {
      const res = await importer.generateDbml(schemaJson);
      (new OutputFilePlugin(resolvePaths(opts.outFile))).write(res);

      // bearer:disable javascript_lang_logger
      console.log(`  ${chalk.green(figures.main.tick)} Generated DBML file from database's connection: ${path.basename(opts.outFile)}`);
    }
  } catch (error) {
    logger.error(error);
  }
}
