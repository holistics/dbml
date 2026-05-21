import fs from 'fs';
import path from 'path';

export function scanDirNames (dirname: string, subpath: string): string[] {
  const dirPath = path.join(dirname, subpath);
  const sanitizedDirPath = path.normalize(dirPath);
  const dirs = fs.readdirSync(sanitizedDirPath);
  return dirs;
}
