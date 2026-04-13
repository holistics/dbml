import {
  basename, dirname, extname, isAbsolute, join, normalize, relative, resolve,
} from 'pathe';
import type {
  Internable,
} from './internable';

const DBML_EXT = '.dbml';

declare const __filepathIdBrand: unique symbol;
export type FilepathId = string & { [__filepathIdBrand]: true };

export class Filepath implements Internable<FilepathId> {
  private readonly path: string;

  constructor (absolutePath: string) {
    if (!isAbsolute(absolutePath)) {
      throw new Error(`FilePath requires an absolute path, got: "${absolutePath}"`);
    }
    this.path = normalize(absolutePath);
  }

  intern (): FilepathId {
    return `filepath@${this.path}` as FilepathId;
  }

  static from (absolutePath: string): Filepath {
    return new Filepath(absolutePath);
  }

  static resolve (fromDir: string, relativePath: string): Filepath {
    return new Filepath(resolve(fromDir, relativePath));
  }

  static fromUri (uri: string): Filepath {
    // Parse file:// URIs to absolute paths
    // file:///C:/Users/... (Windows) or file:///home/user/... (Unix)
    let path = uri;
    if (uri.startsWith('file://')) {
      path = uri.slice(7); // Remove 'file://'
      // On Windows, file:///C:/path becomes C:/path after removing file://
      // On Unix, file:///path stays /path
      if (path.startsWith('/') && /^\/[a-zA-Z]:/.test(path)) {
        // Windows: file:///C:/path → C:/path (remove leading /)
        path = path.slice(1);
      }
    }
    return new Filepath(resolve(path));
  }

  get absolute (): string {
    return this.path;
  }

  get dirname (): string {
    return dirname(this.path);
  }

  get basename (): string {
    return basename(this.path);
  }

  get extname (): string {
    return extname(this.path);
  }

  // Resolve a relative path from this file's directory.
  resolve (relativePath: string): Filepath {
    // Filepath is a virtual path abstraction backed by in-memory maps, not real filesystem I/O
    // bearer:disable javascript_lang_path_traversal
    return new Filepath(resolve(this.dirname, relativePath));
  }

  // Return a new FilePath with the given filename appended to this directory
  join (...segments: string[]): Filepath {
    // Filepath is a virtual path abstraction backed by in-memory maps, not real filesystem I/O
    // bearer:disable javascript_lang_path_traversal
    return new Filepath(join(this.path, ...segments));
  }

  // Return the path relative to a given base directory
  relativeTo (baseDir: string): string {
    return relative(baseDir, this.path);
  }

  toString (): string {
    return this.path;
  }

  equals (other: Filepath): boolean {
    return this.path === other.path;
  }

  toUri (): string {
    // Convert absolute path to file:// URI
    // C:/Users/... → file:///C:/Users/...
    // /home/user/... → file:///home/user/...
    if (process.platform === 'win32') {
      return `file:///${this.path.replace(/\\/g, '/')}`;
    }
    return `file://${this.path}`;
  }

  static isRelative (p: string): boolean {
    return !isAbsolute(p);
  }
}

// Virtual filepath used when no real filesystem path is available (single-file / in-memory mode)
export const DEFAULT_FILEPATH = new Filepath('/main.dbml');

// Resolve the relativePath
// based on the currentFilepath
// Append `.dbml` if relativePath does not ends with `.dbml`
export function resolveImportFilepath (currentFilepath: Filepath, relativePath: string): Filepath | undefined {
  if (!Filepath.isRelative(relativePath)) return undefined;
  const resolved = Filepath.resolve(currentFilepath.dirname, relativePath);
  return resolved.absolute.endsWith(DBML_EXT) ? resolved : Filepath.from(resolved.absolute + DBML_EXT);
}
