import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { Filepath, type DbmlProjectLayout } from '@dbml/core';

export default class NodeProjectLayout implements DbmlProjectLayout {
  private entryPoints: Filepath[];
  private cache = new Map<string, string>();
  private overrides = new Map<string, string>();
  private deleted = new Set<string>();

  constructor (entryPoints: Filepath[]) {
    this.entryPoints = entryPoints;
  }

  setSource (filePath: Filepath, content: string): void {
    this.overrides.set(filePath.absolute, content);
    this.deleted.delete(filePath.absolute);
  }

  getSource (filePath: Filepath): string | undefined {
    const abs = filePath.absolute;

    if (this.deleted.has(abs)) return undefined;
    if (this.overrides.has(abs)) return this.overrides.get(abs);
    if (this.cache.has(abs)) return this.cache.get(abs);

    try {
      const content = readFileSync(abs, 'utf-8');
      this.cache.set(abs, content);
      return content;
    } catch {
      return undefined;
    }
  }

  deleteSource (filePath: Filepath): void {
    const abs = filePath.absolute;
    this.overrides.delete(abs);
    this.cache.delete(abs);
    this.deleted.add(abs);
  }

  clearSource (): void {
    this.overrides.clear();
    this.cache.clear();
    this.deleted.clear();
  }

  exists (filePath: Filepath): boolean {
    const abs = filePath.absolute;
    if (this.deleted.has(abs)) return false;
    if (this.overrides.has(abs)) return true;
    return existsSync(abs);
  }

  listDirectory (dirPath?: Filepath): Filepath[] {
    const base = dirPath?.absolute ?? '/';

    try {
      return readdirSync(base)
        .map((name) => Filepath.from(join(base, name)))
        .filter((fp) => !this.deleted.has(fp.absolute));
    } catch {
      return [];
    }
  }

  getEntryPoints (): Filepath[] {
    return this.entryPoints.filter((fp) => !this.deleted.has(fp.absolute));
  }
}
