const fs = require('fs');
const path = require('path');

const scanDirNames = (dirname: string, subpath: string): string[] => {
  const dirPath = path.join(dirname, subpath);
  const dirs = fs.readdirSync(dirPath);
  return dirs;
};

export {
  scanDirNames,
};
