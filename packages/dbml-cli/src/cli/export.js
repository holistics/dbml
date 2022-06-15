import figures from 'figures';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { exporter } from '@dbml/core';
import {
  validateInputFilePaths,
  resolvePaths,
  getFormatOpt,
  generate,
} from './utils';
import { validateFilePlugin } from './validatePlugins/validatePlugins';
import OutputConsolePlugin from './outputPlugins/outputConsolePlugin';
import OutputFilePlugin from './outputPlugins/outputFilePlugin';
import config from './config';
import logger from '../helpers/logger';

export async function exportHandler (program) {
  try {
    const inputPaths = resolvePaths(program.args);
    validateInputFilePaths(inputPaths, validateFilePlugin);
    const opts = program.opts();

    const format = getFormatOpt(opts);

    if (!opts.outFile && !opts.outDir) {
      generate(inputPaths, (dbml) => exporter.export(dbml, format), OutputConsolePlugin);
    } else if (opts.outFile) {
      const header = [
        '-- SQL dump generated using DBML (dbml-lang.org)\n',
        `-- Database: ${config[format].name}\n`,
        `-- Generated at: ${new Date().toISOString()}\n\n`,
      ].join('');

      generate(inputPaths, (dbml) => exporter.export(dbml, format),
        new OutputFilePlugin(resolvePaths(opts.outFile), header));

      console.log(`  ${chalk.green(figures.main.tick)} Generated SQL dump file (${config[format].name}): ${path.basename(opts.outFile)}`);
    }
  } catch (err) {
    logger.error(err);
  }
}

export async function amlExportHandler (program) {
  try {
    const inputPaths = resolvePaths(program.args);
    validateInputFilePaths(inputPaths, validateFilePlugin);

    const dbml = fs.readFileSync(inputPaths[0], 'utf-8');

    const options = program.opts();

    const outDir = options.outDir ? resolvePaths(options.outDir) : process.cwd();

    const exportOptions = {
      dataSource: options.dataSource,
    };

    const header = [
      '// AML dump generated using DBML (dbml.org)\n',
      `// Generated at: ${new Date().toISOString()}\n\n`,
    ].join('');

    const {
      datasets,
      models,
      relationships,
    } = exporter.exportV2(dbml, 'aml', exportOptions);

    if (datasets) {
      datasets.map((file) => {
        const outFilePath = path.resolve(outDir, file.name);
        const writer = new OutputFilePlugin(outFilePath, header);
        writer.writeDir(file.content);
        console.log(`  ${chalk.green(figures.main.tick)} Generated AML dataset files: ${path.basename(outFilePath)}`);
      });
    }

    if (models) {
      models.map((file) => {
        const outFilePath = path.resolve(outDir, file.name);
        const writer = new OutputFilePlugin(outFilePath, header);
        writer.writeDir(file.content);
        console.log(`  ${chalk.green(figures.main.tick)} Generated AML model files: ${path.basename(outFilePath)}`);
      });
    }

    if (relationships) {
      relationships.map((file) => {
        const outFilePath = path.resolve(outDir, file.name);
        const writer = new OutputFilePlugin(outFilePath, header);
        writer.writeDir(file.content);
        console.log(`  ${chalk.green(figures.main.tick)} Generated AML relationship files: ${path.basename(outFilePath)}`);
      });
    }
  } catch (err) {
    logger.error(err);
  }
}
