import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'path';

declare const __filepathKeyBrand: unique symbol;
export type FilepathKey = string & { [__filepathKeyBrand]: true };

export class Filepath {
  private readonly path: string;

  constructor (absolutePath: string) {
    if (!isAbsolute(absolutePath)) {
      throw new Error(`FilePath requires an absolute path, got: "${absolutePath}"`);
    }
    this.path = normalize(absolutePath);
  }

  get key (): FilepathKey {
    return this.path as FilepathKey;
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
    return new Filepath(resolve(this.dirname, relativePath));
  }

  // Return a new FilePath with the given filename appended to this directory
  join (...segments: string[]): Filepath {
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
}
