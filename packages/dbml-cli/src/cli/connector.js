import { connector } from '@dbml/core';
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
    const opts = program.opts();
    const { format, connection } = getConnectionOpt(opts);

    if (!opts.outFile && !opts.outDir) {
      const res = await connector.fetch(connection, format);
      OutputConsolePlugin.write(res);
    } else if (opts.outFile) {
      // generate(null, () => connector.fetch(connection, format), new OutputFilePlugin(resolvePaths(opts.outFile)));
      const res = await connector.fetch(connection, format);
      (new OutputFilePlugin(resolvePaths(opts.outFile))).write(res);

      console.log(`  ${chalk.green(figures.main.tick)} Generated DBML file from database's connection ${JSON.stringify(connection)} : ${path.basename(opts.outFile)}`);
    }
  } catch (error) {
    logger.error(error);
  }
}
