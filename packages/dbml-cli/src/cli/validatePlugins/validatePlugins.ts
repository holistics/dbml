import fs from 'fs';

function validateFilePlugin (_path: string) {
  const stat = fs.statSync(_path);
  if (stat.isDirectory()) {
    throw new Error('Expect input to be files');
  }
}

export {
  validateFilePlugin,
};
