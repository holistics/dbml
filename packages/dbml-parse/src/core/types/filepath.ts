import {
  basename, dirname, extname, isAbsolute, join, normalize, relative, resolve,
} from 'pathe';
import type {
  Internable,
} from './internable';
import {
  DBML_EXT,
} from '@/constants';

// Matches a Windows drive-letter prefix after normalization (e.g. "C:/").
// Used only in fromUri/toUri where URL parsing adds/needs an extra leading slash.
const WIN_DRIVE_RE = /^[a-zA-Z]:\//;

declare const __filepathIdBrand: unique symbol;
export type FilepathId = string & { [__filepathIdBrand]: true };

export class Filepath implements Internable<FilepathId> {
  private readonly path: string;

  constructor (absolutePath: string) {
    const normalized = normalize(absolutePath);
    if (!isAbsolute(normalized)) {
      throw new Error(`FilePath requires an absolute path, got: "${absolutePath}"`);
    }
    this.path = normalized;
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
    if (uri.startsWith('file://')) {
      let p = decodeURIComponent(new URL(uri).pathname);
      // Windows: URL gives /C:/path - strip the leading slash
      if (/^\/[a-zA-Z]:[\\/]/.test(p)) p = p.slice(1);
      return new Filepath(normalize(p));
    }
    return new Filepath(normalize(uri));
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
    // Use URL to handle percent-encoding of spaces and non-ASCII characters.
    // Windows: C:/path needs an extra leading slash -> file:///C:/path
    const prefix = WIN_DRIVE_RE.test(this.path) ? 'file:///' : 'file://';
    return new URL(prefix + this.path).href;
  }

  static isRelative (p: string): boolean {
    return !isAbsolute(normalize(p));
  }
}

// Resolve the relativePath
// based on the currentFilepath
// Append `.dbml` if relativePath does not ends with `.dbml`
export function resolveImportFilepath (currentFilepath: Filepath, relativePath: string): Filepath | undefined {
  if (!Filepath.isRelative(relativePath)) return undefined;
  const resolved = Filepath.resolve(currentFilepath.dirname, relativePath);
  return resolved.absolute.endsWith(DBML_EXT) ? resolved : Filepath.from(resolved.absolute + DBML_EXT);
}
