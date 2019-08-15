import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import { importer } from '@dbml/core';
import { generateFilePathList, createGenerateTaskList, validate } from './utils';
import logger from '../helpers/logger';
import { SyntaxError } from '../errors';

Promise.promisifyAll(fs);

function getInputFileExtension (format) {
  switch (format) {
    case 'mysql':
    case 'postgres':
      return '.sql';

    case 'json':
      return '.json';

    default:
      throw new Error(`The ${format} format is not supported`);
  }
}

function getOutputFileExtension () {
  return '.dbml';
}

async function generateDBMLFile (inputPath, outputPath, format) {
  const fileContent = await fs.readFileAsync(inputPath, 'utf-8');
  let dbml = '';

  try {
    dbml = importer.import(fileContent, format);
  } catch (err) {
    throw new SyntaxError(path.basename(inputPath), err);
  }

  await fs.writeFileAsync(outputPath, dbml);
}

export default async function importHandler (pathspec, cmd) {
  try {
    const inputPath = path.resolve(process.cwd(), pathspec);
    const outputPath = path.resolve(process.cwd(), cmd.output);

    const format = validate(cmd.opts());
    const inputFileExtension = getInputFileExtension(format);
    const outputFileExtension = getOutputFileExtension();
    const filePathList = await generateFilePathList(inputPath, outputPath, inputFileExtension, outputFileExtension);

    await createGenerateTaskList(filePathList, format, generateDBMLFile);
  } catch (err) {
    logger.error(err);
  }
}

export {
  getInputFileExtension,
  getOutputFileExtension,
};
