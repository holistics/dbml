import path from 'path';
import fs from 'fs';
import Promise from 'bluebird';
import Listr from 'listr';
import figures from 'figures';
import chalk from 'chalk';

Promise.promisifyAll(fs);

function validate (flags) {
  const keys = Object.keys(flags).filter(key => key !== 'output');
  let counter = 0;
  let format = 'json';
  for (let i = 0; i < keys.length; i += 1) {
    if (flags[keys[i]]) {
      counter += 1;
      if (counter > 1) throw new Error('Too many options');
      format = keys[i];
    }
  }
  return format;
}

async function generateFilePathList (inputPath, outputPath, inputFileExtension, outputFileExtension) {
  const inputStats = await fs.statAsync(inputPath);
  const isDirectory = inputStats.isDirectory();
  const filePathList = [];

  if (isDirectory) {
    // inputPath is directory => outputPath must be directory
    // check if directory or file exist
    const outputStats = await fs.statAsync(outputPath);

    // if path is file, throw error
    if (!outputStats.isDirectory()) {
      throw new Error('Expect an output path is a directory');
    }

    const files = await fs.readdirAsync(inputPath);

    files.forEach(file => {
      if (path.extname(file) !== inputFileExtension) {
        return;
      }

      const fileNameWithoutExtension = path.basename(file, inputFileExtension);
      const outputFile = `${fileNameWithoutExtension}${outputFileExtension}`;

      filePathList.push({
        inputFile: `${inputPath}/${file}`,
        outputFile: `${outputPath}/${outputFile}`,
      });
    });
  } else {
    try {
      const outputStats = await fs.statAsync(outputPath);
      if (outputStats.isDirectory()) {
        const fileNameWithoutExtension = path.basename(inputPath, inputFileExtension);
        const outputFile = `${fileNameWithoutExtension}${outputFileExtension}`;
        filePathList.push({
          inputFile: inputPath,
          outputFile: `${outputPath}/${outputFile}`,
        });
      } else {
        filePathList.push({
          inputFile: inputPath,
          outputFile: outputPath,
        });
      }
    } catch (err) {
      filePathList.push({
        inputFile: inputPath,
        outputFile: outputPath,
      });
    }
  }

  return filePathList;
}

async function createGenerateTaskList (filePathList, format, generateAsyncFunction) {
  const taskList = [];
  filePathList.forEach((filePath) => {
    taskList.push({
      title: `Generate ${path.basename(filePath.inputFile)} ${figures.arrowRight}  ${path.basename(filePath.outputFile)}`,
      task: () => generateAsyncFunction(filePath.inputFile, filePath.outputFile, format),
    });
  });

  const tasks = new Listr(taskList, { concurrent: true });

  await tasks.run();
  if (filePathList.length !== 0) {
    console.log('');
    console.log(`  ${chalk.bgGreen.bold('DONE')} Generated files at ${path.dirname(filePathList[0].outputFile)}`);
  }
}

export {
  generateFilePathList,
  createGenerateTaskList,
  validate,
};
