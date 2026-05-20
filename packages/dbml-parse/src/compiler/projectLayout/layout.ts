import { Filepath } from '@/core/types/filepath';

// A read-only view of the project layout.
// Consumers mutate the concrete class directly. The compiler detects
// content changes automatically when `getSource` or `getEntrypoints` is called.
export interface DbmlProjectLayout {
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
