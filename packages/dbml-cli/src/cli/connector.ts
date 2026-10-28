import path from 'path';
import { connector } from '@dbml/connector';
import { importer } from '@dbml/core';
import chalk from 'chalk';
import { Command } from 'commander';
import figures from 'figures';
import { consoleLogger, fileLogger } from '../helpers/logger';
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
    const options = program.opts();
    const schemaJson = await connector.fetchSchemaJson(connection, databaseType);

    if (!options.outFile && !options.outDir) {
      const result = importer.generateDbml(schemaJson);
      OutputConsolePlugin.write(result);
    } else if (options.outFile) {
      const result = importer.generateDbml(schemaJson);
      (new OutputFilePlugin(resolvePaths(options.outFile))).write(result);

      // bearer:disable javascript_lang_logger
      console.log(`  ${chalk.green(figures.main.tick)} Generated DBML file from database's connection: ${path.basename(options.outFile)}`);
    }
  } catch (error) {
    consoleLogger.error(error as Error | string);
    fileLogger.error(error as Error | string);
  }
}
