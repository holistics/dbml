import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'pathe';
import type { Internable } from './internable';

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
    return this.path as FilepathId;
  }

  static from (absolutePath: string): Filepath {
    return new Filepath(absolutePath);
  }

  static resolve (fromDir: string, relativePath: string): Filepath {
    return new Filepath(resolve(fromDir, relativePath));
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

  static isRelative (p: string): boolean {
    return !isAbsolute(p);
  }
}
