import {
  existsSync, readFileSync, readdirSync, statSync,
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
  // Overlay is an overriding map of file absolute paths to file content
  // `null`: The file is deleted
  private overlay = new Map<string, string | null>();
  private entryPoints: Filepath[];

  constructor (entryPoints: Filepath[]) {
    this.entryPoints = [...entryPoints];
  }

  setSource (filePath: Filepath, content: string): void {
    this.overlay.set(filePath.absolute, content);
  }

  getSource (filePath: Filepath): string | undefined {
    const absolutePath = filePath.absolute;

    // If overlay already has the file,
    // return its content
    if (this.overlay.has(absolutePath)) {
      const value = this.overlay.get(absolutePath);
      return value ?? undefined; // null (deleted) -> undefined
    }
    try {
      return readFileSync(absolutePath, 'utf-8');
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
    return this.isFile(filePath) || this.isDirectory(filePath);
  }

  isFile (filePath: Filepath): boolean {
    const absolutePath = filePath.absolute;

    if (this.overlay.has(absolutePath)) return this.overlay.get(absolutePath) !== null;

    try {
      // `statSync` (not lstatSync) so symlinks resolve to their target, matching
      // how node reads the file on disk.
      return statSync(absolutePath).isFile();
    } catch {
      return false;
    }
  }

  isDirectory (filePath: Filepath): boolean {
    const absolutePath = filePath.absolute;

    try {
      // Exist in filesystem
      if (statSync(absolutePath).isDirectory()) return true;
    } catch {
      // fall through: the path may exist only in the overlay
    }
    for (const [overlayPath, content] of this.overlay) {
      if (content === null) continue;
      if (overlayPath.startsWith(absolutePath)) return true;
    }
    return false;
  }

  listDirectory (dirPath?: Filepath): Filepath[] {
    const basePath = dirPath?.absolute ?? '/';
    const results = new Set<string>();

    try {
      // Filesystem entries
      for (const entry of readdirSync(basePath)) {
        results.add(basePath + entry);
      }
    } catch {
      // Not a readable directory - ignore
    }

    // Overlay additions: non-deleted files directly under base
    for (const [abs, content] of this.overlay) {
      if (content === null) continue;
      if (!abs.startsWith(basePath)) continue;
      if (!abs.slice(basePath.length).includes('/')) results.add(abs);
    }

    // Remove overlay-deleted paths
    for (const [overlayPath, content] of this.overlay) {
      if (content === null) results.delete(overlayPath);
    }

    return [...results].sort().map(Filepath.from);
  }

  getEntrypoints (): Filepath[] {
    return this.entryPoints.filter((fp) => this.exists(fp));
  }

  clone (): NodeProjectLayout {
    const copy = new NodeProjectLayout([...this.entryPoints]);
    for (const [overlayPath, content] of this.overlay) {
      copy.overlay.set(overlayPath, content);
    }
    return copy;
  }
}
