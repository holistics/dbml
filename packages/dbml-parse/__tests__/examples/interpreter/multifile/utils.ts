import Compiler from '@/compiler';
import { Database, Filepath } from '@/index';
import { UNHANDLED } from '@/core/types/module';
import { SymbolKind } from '@/core/types/symbol';
import type { CanonicalName } from '@/compiler/queries/canonicalName';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';

export function setupCompiler (files: Record<string, string>): { compiler: Compiler; sources: Map<Filepath, string> } {
  const layout = new MemoryProjectLayout();
  const sources = new Map<Filepath, string>();
  for (const [path, src] of Object.entries(files)) {
    const filepath = Filepath.from(path);
    layout.setSource(filepath, src);
    sources.set(filepath, src);
  }
  const compiler = new Compiler(layout);
  return { compiler, sources };
}

export function fp (path: string): Filepath {
  return Filepath.from(path);
}

export function getDatabase (compiler: Compiler, path: string): Database {
  const result = compiler.interpretFile(fp(path));
  expect(result.getErrors()).toHaveLength(0);
  return result.getValue()! as Database;
}

export function findTable (compiler: Compiler, path: string, name: string) {
  const ast = compiler.parseFile(fp(path)).getValue().ast;
  const prog = compiler.nodeSymbol(ast).getFiltered(UNHANDLED)!;
  const members = compiler.symbolMembers(prog).getFiltered(UNHANDLED) ?? [];
  for (const m of members) {
    if (m.isKind(SymbolKind.Schema)) {
      const sub = compiler.symbolMembers(m).getFiltered(UNHANDLED) ?? [];
      const found = sub.find((s) => s.isKind(SymbolKind.Table) && s.name === name);
      if (found) return found;
    }
    if (m.isKind(SymbolKind.Table) && m.name === name) return m;
  }
  return undefined;
}

export function canonicalName (compiler: Compiler, path: string, tableName: string): CanonicalName | undefined {
  const t = findTable(compiler, path, tableName);
  if (!t) return undefined;
  return compiler.canonicalName(fp(path), t.originalSymbol).getValue();
}
