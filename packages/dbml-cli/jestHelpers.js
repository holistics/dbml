const fs = require('fs');
const path = require('path');

global.scanDirNames = (dirname, subpath) => {
  const dirPath = path.join(dirname, subpath);
  const dirs = fs.readdirSync(dirPath);
  return dirs;
};
