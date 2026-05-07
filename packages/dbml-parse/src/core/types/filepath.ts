import {
  basename, dirname, extname, isAbsolute, join, normalize, relative, resolve,
} from 'pathe';
import type {
  Internable,
} from './internable';

// Matches a Windows drive-letter prefix after normalization (e.g. "C:/").
const WIN_DRIVE_RE = /^[a-zA-Z]:\//;

declare const __filepathIdBrand: unique symbol;
export type FilepathId = string & { [__filepathIdBrand]: true };

export class Filepath implements Internable<FilepathId> {
  private readonly protocol?: string; // The protocol, such as `file` or `inmemory`
  private readonly path: string;

  constructor (absolutePath: string, options: { protocol?: string } = {}) {
    const normalized = normalize(absolutePath);
    if (!isAbsolute(normalized)) {
      throw new Error(`FilePath requires an absolute path, got: "${absolutePath}"`);
    }
    this.path = normalized;
    this.protocol = options.protocol;
  }

  intern (): FilepathId {
    if (!this.protocol) return `filepath@${this.path}` as FilepathId;
    return `filepath@${this.path}` as FilepathId;
  }

  static from (absolutePath: string): Filepath {
    return new Filepath(absolutePath);
  }

  static resolve (fromDir: string, relativePath: string): Filepath {
    return new Filepath(resolve(fromDir, relativePath));
  }

  // Convert monaco URI to filepath
  static fromUri (uri: string): Filepath {
    try {
      const url = new URL(uri);
      const raw = url.host ? `/${url.host}${url.pathname}` : url.pathname; // Treat url host as part of the path
      return new Filepath(normalize(raw), {
        protocol: url.protocol,
      });
    } catch {
      // Not a valid URL - fall through to treat as plain path
      return new Filepath(normalize(uri));
    }
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

  // Return the path relative to a given base directory, always prefixed with './' or '../'
  relativeTo (baseDir: string): string {
    const rel = relative(baseDir, this.path);
    return rel.startsWith('.') ? rel : `./${rel}`;
  }

  toString (): string {
    return this.path;
  }

  equals (other: Filepath): boolean {
    return this.path === other.path;
  }

  // True when this filepath is a strict ancestor directory of `other`.
  isParentOf (other: Filepath): boolean {
    if (this.path === other.path) return false;
    const prefix = this.path.endsWith('/') ? this.path : `${this.path}/`;
    return other.path.startsWith(prefix);
  }

  // Convert filepath to monaco URI
  toUri (options: { protocol?: string } = {}): string {
    const protocol = options.protocol ?? this.protocol;
    if (protocol === undefined) {
      return this.path;
    }
    // Windows: C:/path needs an extra leading slash -> file:///C:/path
    const prefix = WIN_DRIVE_RE.test(this.path) ? `${protocol}:///` : `${protocol}://`;
    return new URL(prefix + this.path).href; // URL is used to handle url-encoded chars
  }

  static isRelative (p: string): boolean {
    return !isAbsolute(normalize(p));
  }
}

// From the currentFilepath, resolve the relativePath to an absolute path
// Append `.dbml` if relativePath does not ends with `.dbml`
export function resolveImportFilepath (currentFilepath: Filepath, relativePath: string): Filepath | undefined {
  if (!Filepath.isRelative(relativePath)) return undefined;
  const resolved = Filepath.resolve(currentFilepath.dirname, relativePath);
  return resolved.absolute.endsWith('.dbml') ? resolved : Filepath.from(resolved.absolute + '.dbml');
}
