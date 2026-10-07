import {
  readFileSync, readdirSync, statSync,
} from 'node:fs';
import {
  type DbmlProjectLayout, Filepath,
} from '@dbml/parse';
import {
  fileLogger,
} from './helpers/logger';

/**
 * A read-only DbmlProjectLayout backed by the Node.js filesystem.
 */
export class NodeProjectLayout implements DbmlProjectLayout {
  private readonly entryPoints: Filepath[];

  constructor (entryPoints: Filepath[]) {
    this.entryPoints = [...entryPoints];
  }

  // From the currentFilepath, resolve the relativePath to an absolute path
  // Append `.dbml` if relativePath does not ends with `.dbml`
  resolveFileSpecifier (currentFilepath: Filepath, relativePath: string): Filepath | undefined {
    if (!Filepath.isRelative(relativePath)) return undefined;
    const resolved = Filepath.resolve(currentFilepath.dirname, relativePath);
    return resolved.absolute.endsWith('.dbml') ? resolved : Filepath.from(resolved.absolute + '.dbml');
  }

  getSource (filePath: Filepath): string | undefined {
    return safeReadFileSync(filePath.fsPath, 'utf-8');
  }

  exists (filePath: Filepath): boolean {
    return this.isFile(filePath) || this.isDirectory(filePath);
  }

  isFile (filePath: Filepath): boolean {
    return safeStatSync(filePath.fsPath, {
      throwIfNoEntry: false,
    })?.isFile() ?? false;
  }

  isDirectory (filePath: Filepath): boolean {
    return safeStatSync(filePath.fsPath, {
      throwIfNoEntry: false,
    })?.isDirectory() ?? false;
  }

  listDirectory (dirPath?: Filepath): Filepath[] {
    const basePath = dirPath ? dirPath.fsPath : '/';
    return safeReaddirSync(basePath)?.map((entry) => basePath + entry).sort().map(Filepath.from) ?? [];
  }

  getEntrypoints (): Filepath[] {
    return this.entryPoints.filter((fp) => this.exists(fp));
  }
}

// Wrap a function so that errors are logged to file and undefined is returned
function logOnError<Args extends unknown[], R> (fn: (...args: Args) => R): (...args: Args) => R | undefined {
  return (...args) => {
    try {
      return fn(...args);
    } catch (e) {
      fileLogger.error(e instanceof Error ? e : new Error(String(e)));
      return undefined;
    }
  };
}

const safeReadFileSync = logOnError(readFileSync as (path: string, encoding: BufferEncoding) => string);
const safeReaddirSync = logOnError(readdirSync as (path: string) => string[]);
const safeStatSync = logOnError(
  (path: string, opts: { throwIfNoEntry: false }) => statSync(path, opts),
);
