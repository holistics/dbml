import {
  readFileSync, readdirSync, statSync,
} from 'node:fs';
import {
  type DbmlProjectLayout, Filepath,
} from '@dbml/parse';

/**
 * A read-only DbmlProjectLayout backed by the Node.js filesystem.
 *
 * getSource      -> fs.readFileSync
 * exists         -> statSync (isFile || isDirectory)
 * isFile         -> statSync().isFile()
 * isDirectory    -> statSync().isDirectory()
 * listDirectory  -> fs.readdirSync
 * getEntrypoints -> filtered constructor arg
 */
export class NodeProjectLayout implements DbmlProjectLayout {
  private readonly entryPoints: Filepath[];

  constructor (entryPoints: Filepath[]) {
    this.entryPoints = [...entryPoints];
  }

  getSource (filePath: Filepath): string | undefined {
    try {
      return readFileSync(filePath.absolute, 'utf-8');
    } catch {
      return undefined;
    }
  }

  exists (filePath: Filepath): boolean {
    return this.isFile(filePath) || this.isDirectory(filePath);
  }

  isFile (filePath: Filepath): boolean {
    try {
      return statSync(filePath.absolute).isFile();
    } catch {
      return false;
    }
  }

  isDirectory (filePath: Filepath): boolean {
    try {
      return statSync(filePath.absolute).isDirectory();
    } catch {
      return false;
    }
  }

  listDirectory (dirPath?: Filepath): Filepath[] {
    const basePath = dirPath?.absolute ?? '/';
    try {
      return readdirSync(basePath)
        .map((entry) => basePath + entry)
        .sort()
        .map(Filepath.from);
    } catch {
      return [];
    }
  }

  getEntrypoints (): Filepath[] {
    return this.entryPoints.filter((fp) => this.exists(fp));
  }
}
