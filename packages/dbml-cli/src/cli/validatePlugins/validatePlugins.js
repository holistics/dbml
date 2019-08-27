import fs from 'fs';

function validateFilePlugin (_path) {
  const stat = fs.statSync(_path);
  if (stat.isDirectory(_path)) {
    throw new Error('Expect input to be files');
  }
}

export {
  validateFilePlugin,
};
