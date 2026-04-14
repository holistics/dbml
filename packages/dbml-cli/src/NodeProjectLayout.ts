import {
  existsSync, readFileSync, readdirSync,
} from 'node:fs';
import {
  type DbmlProjectLayout, Filepath,
} from '@dbml/parse';

/**
 * A DbmlProjectLayout backed by the Node.js filesystem.
 * Reads source files on demand from disk; setSource/deleteSource maintain an
 * in-memory overlay (e.g. for unsaved edits) without touching the real FS.
 */
export class NodeProjectLayout implements DbmlProjectLayout {
  // null = explicitly deleted in overlay, string = overridden content
  private overlay = new Map<string, string | null>();
  private entryPoints: Filepath[];

  constructor (entryPoints: Filepath[]) {
    this.entryPoints = [...entryPoints];
  }

  setSource (filePath: Filepath, content: string): void {
    this.overlay.set(filePath.absolute, content);
  }

  getSource (filePath: Filepath): string | undefined {
    const abs = filePath.absolute;
    if (this.overlay.has(abs)) {
      const val = this.overlay.get(abs);
      return val ?? undefined; // null (deleted) -> undefined
    }
    try {
      return readFileSync(abs, 'utf-8');
    } catch {
      return undefined;
    }
  }

  deleteSource (filePath: Filepath): void {
    this.overlay.set(filePath.absolute, null);
  }

  clearSource (): void {
    this.overlay.clear();
    this.entryPoints = [];
  }

  exists (filePath: Filepath): boolean {
    const abs = filePath.absolute;
    if (this.overlay.has(abs)) {
      return this.overlay.get(abs) !== null;
    }
    return existsSync(abs);
  }

  listDirectory (dirPath?: Filepath): Filepath[] {
    const base = dirPath?.absolute ?? '/';
    const prefix = base.endsWith('/') ? base : base + '/';
    const results = new Set<string>();

    // Filesystem entries
    try {
      for (const entry of readdirSync(base)) {
        results.add(prefix + entry);
      }
    } catch {
      // Not a readable directory — ignore
    }

    // Overlay additions: non-deleted files directly under base
    for (const [abs, content] of this.overlay) {
      if (content === null) continue;
      if (!abs.startsWith(prefix)) continue;
      if (!abs.slice(prefix.length).includes('/')) results.add(abs);
    }

    // Remove overlay-deleted paths
    for (const [abs, content] of this.overlay) {
      if (content === null) results.delete(abs);
    }

    return [...results].sort().map(Filepath.from);
  }

  getEntryPoints (): Filepath[] {
    return this.entryPoints.filter((fp) => this.exists(fp));
  }

  clone (): NodeProjectLayout {
    const copy = new NodeProjectLayout([...this.entryPoints]);
    for (const [abs, content] of this.overlay) {
      copy.overlay.set(abs, content);
    }
    return copy;
  }
}
