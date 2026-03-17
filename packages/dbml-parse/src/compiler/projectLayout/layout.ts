import { Filepath, FilepathKey } from './filepath';

export interface DbmlProjectLayout {
  // Override the content of a file in-memory without touching the underlying source
  setSource (filePath: Filepath, content: string): void;

  // Read a file at the given path
  getSource (filePath: Filepath): string | undefined;

  // Remove a file entirely from the layout
  deleteSource (filePath: Filepath): void;

  // Return true if a file or directory exists at the given path
  exists (filePath: Filepath): boolean;

  // List immediate entries inside a directory, defaults to project root
  listDirectory (dirPath?: Filepath): Filepath[];

  // List all files recursively under the given directory, defaults to project root
  listAllFiles (dirPath?: Filepath): Filepath[];
}

// All files are provided up front; no lazy loading
// This one is mainly used for testing
// Or webapps where there's no native filesystem
export class MemoryProjectLayout implements DbmlProjectLayout {
  private files: Map<string, string>;

  constructor (files: Map<FilepathKey, string> | Record<FilepathKey, string> = {}) {
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

  exists (filePath: Filepath): boolean {
    const abs = filePath.absolute;
    if (this.files.has(abs)) return true;
    const prefix = abs + '/';
    return [...this.files.keys()].some((f) => f.startsWith(prefix));
  }

  listDirectory (dirPath: Filepath): Filepath[] {
    const base = dirPath.absolute;
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

  listAllFiles (dirPath: Filepath): Filepath[] {
    const base = dirPath.absolute;
    const prefix = base.endsWith('/') ? base : base + '/';
    return [...this.files.keys()]
      .filter((f) => f.startsWith(prefix))
      .map((f) => Filepath.from(f))
      .sort((a, b) => a.absolute.localeCompare(b.absolute));
  }
}
