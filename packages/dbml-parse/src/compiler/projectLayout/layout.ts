import { Filepath } from '@/core/types/filepath';

// A read-only view of the project layout.
// Consumers mutate the concrete class directly. The compiler detects
// content changes automatically when `getSource` or `getEntrypoints` is called.
export interface DbmlProjectLayout {
  // Resolve an import specifier from a current file, MUST BE deterministic
  // For example:
  // - `/dbml/a.dbml` refers to './b.dbml' -> returns `/dbml/b.dbml`
  // - A cloud dbml file refers to '@id' -> returns a unique url associated with the '@id'
  // This one mirrors ECMAScript spec: The runtime chooses how to resolve the specifier, not the language engine
  resolveFileSpecifier (currentFilepath: Filepath, specifier: string): Filepath | undefined;

  getSource (filePath: Filepath): string | undefined;

  exists (filePath: Filepath): boolean;

  isFile (filePath: Filepath): boolean;
  isDirectory (filePath: Filepath): boolean;

  listDirectory (dirPath?: Filepath): Filepath[];

  getEntrypoints (): Filepath[];
}

export class MemoryProjectLayout implements DbmlProjectLayout {
  private readonly files: Map<string, string>;

  constructor (files: Map<string, string> | Record<string, string> = {}) {
    this.files = files instanceof Map
      ? new Map(files)
      : new Map(
          Object.entries(files),
        );
  }

  // From the currentFilepath, resolve the relativePath to an absolute path
  // Append `.dbml` if relativePath does not ends with `.dbml`
  resolveFileSpecifier (currentFilepath: Filepath, relativePath: string): Filepath | undefined {
    if (!Filepath.isRelative(relativePath)) return undefined;
    const resolved = Filepath.resolve(currentFilepath.dirname, relativePath);
    return resolved.absolute.endsWith('.dbml') ? resolved : Filepath.from(resolved.absolute + '.dbml');
  }

  setSource (filePath: Filepath, content: string): void {
    this.files.set(filePath.absolute, content);
  }

  getSource (filePath: Filepath): string | undefined {
    const val = this.files.get(filePath.absolute);
    return val ?? undefined;
  }

  deleteSource (filePath: Filepath): void {
    this.files.delete(filePath.absolute);
  }

  clearSource (): void {
    this.files.clear();
  }

  exists (filePath: Filepath): boolean {
    return this.isFile(filePath) || this.isDirectory(filePath);
  }

  isFile (filePath: Filepath): boolean {
    return this.files.has(filePath.absolute);
  }

  isDirectory (filePath: Filepath): boolean {
    const prefix = filePath.absolute.endsWith('/') ? filePath.absolute : `${filePath.absolute}/`;
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix)) return true;
    }
    return false;
  }

  listDirectory (dirPath?: Filepath): Filepath[] {
    const base = dirPath?.absolute ?? '/';
    const prefix = base.endsWith('/') ? base : base + '/';
    const entries = new Set<string>();

    for (const f of this.files.keys()) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      const slash = rest.indexOf('/');
      entries.add(prefix + (slash === -1 ? rest : rest.slice(0, slash)));
    }

    return [
      ...entries,
    ].sort().map(Filepath.from);
  }

  getEntrypoints (): Filepath[] {
    return [
      ...this.files.keys(),
    ]
      .map(Filepath.from)
      .sort((a, b) => a.absolute.localeCompare(b.absolute));
  }

  clone (): MemoryProjectLayout {
    return new MemoryProjectLayout(this.files);
  }
}
