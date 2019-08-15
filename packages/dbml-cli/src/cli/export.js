import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import { exporter } from '@dbml/core';
import logger from '../helpers/logger';
import { generateFilePathList, createGenerateTaskList, validate } from './utils';
import { SyntaxError } from '../errors';

Promise.promisifyAll(fs);

function getInputFileExtension () {
  return '.dbml';
}

function getOutputFileExtension (format) {
  switch (format) {
    case 'mysql':
    case 'postgres':
      return '.sql';

    case 'json':
      return '.json';

    default:
      logger.error(`The ${format} format is not supported`);
      throw new Error(`The ${format} format is not supported`);
  }
}

async function generateExportFile (inputPath, outputPath, format) {
  const fileContent = await fs.readFileAsync(inputPath, 'utf-8');

  let outputStr = '';
  try {
    outputStr = exporter.export(fileContent, format);
  } catch (err) {
    throw new SyntaxError(path.basename(inputPath), err);
  }

  await fs.writeFileAsync(outputPath, outputStr);
}

export default async function exportHandler (pathspec, cmd) {
  try {
    const inputPath = path.resolve(process.cwd(), pathspec);
    const outputPath = path.resolve(process.cwd(), cmd.output);
    const format = validate(cmd.opts());
    const inputFileExtension = getInputFileExtension();
    const outputFileExtension = getOutputFileExtension(format);
    const filePathList = await generateFilePathList(inputPath, outputPath, inputFileExtension, outputFileExtension);

    await createGenerateTaskList(filePathList, format, generateExportFile);
  } catch (error) {
    logger.error(error);
  }
}

export {
  getInputFileExtension,
  getOutputFileExtension,
};
