import fs from 'fs';
import path from 'path';

export function scanDirectoryNames (dirname: string, subpath: string): string[] {
  const directoryPath = path.join(dirname, subpath);
  const directories = fs.readdirSync(directoryPath);
  return directories;
};
