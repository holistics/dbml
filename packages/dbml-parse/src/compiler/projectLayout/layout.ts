import { Filepath } from '@/core/types/filepath';

// A snapshot of the project layout
// The underlying filesystem is not modified you use `setSource`, `deleteSource`, `clearSource`
// Only the snapshot of it
export interface DbmlProjectLayout {
  setSource (filePath: Filepath, content: string): void;

  getSource (filePath: Filepath): string | undefined;

  deleteSource (filePath: Filepath): void;

  clearSource (): void;

  exists (filePath: Filepath): boolean;

  listDirectory (dirPath?: Filepath): Filepath[];

  getEntryPoints (): Filepath[];
}

export class MemoryProjectLayout implements DbmlProjectLayout {
  private files: Map<string, string>;

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
    const abs = filePath.absolute;
    if (this.files.has(abs)) return true;
    const prefix = abs + '/';
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

    return [...entries].sort().map(Filepath.from);
  }

  getEntryPoints (): Filepath[] {
    return [...this.files.keys()]
      .map(Filepath.from)
      .sort((a, b) => a.absolute.localeCompare(b.absolute));
  }
}
