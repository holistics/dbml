import { readFileSync, readdirSync, statSync } from 'node:fs';
import { type DbmlProjectLayout, type FileSpecifierInfo, Filepath } from '@dbml/parse';
import { fileLogger } from './helpers/logger';

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

  getFileSpecifierInfo (currentFilepath: Filepath, targetFilepath: Filepath): FileSpecifierInfo | undefined {
    let specifier = targetFilepath.relativeTo(currentFilepath.dirname);
    if (specifier.endsWith('.dbml')) specifier = specifier.slice(0, -'.dbml'.length);
    return {
      specifier,
    };
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

  listDirectory (directoryPath?: Filepath): Filepath[] {
    const basePath = directoryPath ? directoryPath.fsPath : '/';
    return safeReaddirSync(basePath)?.map((entry) => basePath + entry).sort().map(Filepath.from) ?? [];
  }

  getEntrypoints (): Filepath[] {
    return this.entryPoints.filter((filepath) => this.exists(filepath));
  }
}

// Wrap a function so that errors are logged to file and undefined is returned
function logOnError<Arguments extends unknown[], R> (fn: (...args: Arguments) => R): (...args: Arguments) => R | undefined {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      fileLogger.error(error instanceof Error ? error : new Error(String(error)));
      return undefined;
    }
  };
}

const safeReadFileSync = logOnError(readFileSync as (path: string, encoding: BufferEncoding) => string);
const safeReaddirSync = logOnError(readdirSync as (path: string) => string[]);
const safeStatSync = logOnError(
  (path: string, options: { throwIfNoEntry: false }) => statSync(path, options),
);
