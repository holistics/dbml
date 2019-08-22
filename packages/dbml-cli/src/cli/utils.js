import path from 'path';
import fs from 'fs';

function resolvePaths (paths) {
  if (!Array.isArray(paths)) {
    return path.resolve(process.cwd(), paths);
  }
  return paths.map((_path) => path.resolve(process.cwd(), _path));
}

function validateInputFilePaths (paths, validatePlugin) {
  return paths.every((_path) => validatePlugin(_path));
}

function getFormatOpt (opts) {
  const formatOpts = Object.keys(opts).filter((opt) => {
    return opt === 'postgres' || opt === 'mysql';
  });

  let format = 'postgres';
  let cnt = 0;

  formatOpts.forEach((opt) => {
    if (opts[opt]) {
      cnt += 1;
      if (cnt > 1) throw new Error('Too many format options');
      format = opt;
    }
  });

  return format;
}

function generate (inputPaths, transform, outputPlugin) {
  inputPaths.forEach((_path) => {
    const source = fs.readFileSync(_path, 'utf-8');
    const content = transform(source);
    outputPlugin.write(content);
  });
}

export {
  resolvePaths,
  validateInputFilePaths,
  getFormatOpt,
  generate,
};
