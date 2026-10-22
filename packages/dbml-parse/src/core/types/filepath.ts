import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  relative,
  resolve,
} from 'pathe';
import type { Internable } from './internable';

declare const __filepathIdBrand: unique symbol;
export type FilepathId = string & { [__filepathIdBrand]: true };

export class Filepath implements Internable<FilepathId> {
  private readonly protocol?: string;
  // Internally: root (/ or C:/) + decoded segments joined by /
  // Segments never contain URI encoding. Encoding only happens in toUri().
  private readonly root: string;
  private readonly segments: string[];

  constructor (absolutePath: string, options: { protocol?: string } = {}) {
    const normalized = normalize(absolutePath);
    if (!isAbsolute(normalized)) {
      throw new Error(
        `FilePath requires an absolute path, got: "${absolutePath}"`,
      );
    }
    const parsed = parse(normalized);
    this.root = parsed.root;
    const rest = normalized.slice(this.root.length);
    this.segments = rest ? rest.split('/').filter(Boolean) : [];
    this.protocol = options.protocol?.replace(/:$/, '');
  }

  // Reconstruct the full path from root + segments
  private get path (): string {
    return this.segments.length > 0
      ? this.root + this.segments.join('/')
      : this.root;
  }

  intern (): FilepathId {
    return `filepath@${this.toKey()}` as FilepathId;
  }

  static from (absolutePath: string): Filepath {
    return new Filepath(absolutePath);
  }

  static resolve (fromDir: string, relativePath: string): Filepath {
    return new Filepath(resolve(fromDir, relativePath));
  }

  // Convert monaco URI to filepath
  static fromUri (uri: string): Filepath {
    // Windows drive path (e.g. C:/..., D:\...) is not a URI
    if (hasDriveRoot(uri)) {
      return new Filepath(uri);
    }
    try {
      const url = new URL(uri);
      const raw = url.host ? `/${url.host}${url.pathname}` : url.pathname;
      // file:///C:/path gives pathname "/C:/path", strip leading / for Windows
      const encoded = hasDriveRoot(raw.slice(1)) ? raw.slice(1) : raw;
      // URL.pathname preserves encoding, decode segments before passing to constructor
      return new Filepath(decodePathSegments(encoded), {
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

  get fsPath (): string {
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

  // Resolve a relative path from this file's directory
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
    if (
      !rel.startsWith('./')
      && !rel.startsWith('../')
      && !['.', '..'].includes(rel)
    ) {
      return `./${rel}`;
    }
    return rel;
  }

  toKey (): string {
    return this.root + this.segments.map(encodeURIComponent).join('/');
  }

  equals (other: Filepath): boolean {
    return this.toKey() === other.toKey();
  }

  // True when this filepath is a strict ancestor directory of `other`
  isParentOf (other: Filepath): boolean {
    if (this.path === other.path) return false;
    const prefix = this.path.endsWith('/') ? this.path : `${this.path}/`;
    return other.path.startsWith(prefix);
  }

  // Convert filepath to monaco URI. Encoding happens here, at the boundary.
  toUri (options: { protocol?: string } = {}): string {
    const protocol = options.protocol || this.protocol;
    if (!protocol) {
      return this.path;
    }
    const encoded = this.root + this.segments.map(encodeURIComponent).join('/');
    // Windows: C:/path needs an extra leading slash -> file:///C:/path
    const prefix = this.root.length > 1 ? `${protocol}:///` : `${protocol}://`;
    return prefix + encoded;
  }

  static isRelative (p: string): boolean {
    return !isAbsolute(normalize(p));
  }
}

// True if the path starts with a Windows drive root (e.g. C:/, D:\)
function hasDriveRoot (p: string): boolean {
  return parse(normalize(p)).root.length > 1;
}

// Decode URI-encoded path segments, preserving the root and structure
function decodePathSegments (p: string): string {
  const normalized = normalize(p);
  const { root } = parse(normalized);
  const rest = normalized.slice(root.length);
  if (!rest) return root;
  return (
    root
    + rest
      .split('/')
      .map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      })
      .join('/')
  );
}
