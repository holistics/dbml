import Compiler from '@/compiler';
import { Database, Filepath } from '@/index';
import { UNHANDLED } from '@/core/types/module';
import { SymbolKind } from '@/core/types/symbol';
import type { CanonicalName } from '@/compiler/queries/canonicalName';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';

export function setupCompiler (files: Record<string, string>): { compiler: Compiler; sources: Map<Filepath, string> } {
  const layout = new MemoryProjectLayout();
  const sources = new Map<Filepath, string>();
  for (const [path, source] of Object.entries(files)) {
    const filepath = Filepath.from(path);
    layout.setSource(filepath, source);
    sources.set(filepath, source);
  }
  const compiler = new Compiler(layout);
  return { compiler, sources };
}

export function filepath (path: string): Filepath {
  return Filepath.from(path);
}

export function getDatabase (compiler: Compiler, path: string): Database {
  const result = compiler.interpretFile(filepath(path));
  expect(result.getErrors()).toHaveLength(0);
  return result.getValue()! as Database;
}

export function findTable (compiler: Compiler, path: string, name: string) {
  const ast = compiler.parseFile(filepath(path)).getValue().ast;
  const prog = compiler.nodeSymbol(ast).getFiltered(UNHANDLED)!;
  const members = compiler.symbolMembers(prog).getFiltered(UNHANDLED) ?? [];
  for (const member of members) {
    if (member.isKind(SymbolKind.Schema)) {
      const sub = compiler.symbolMembers(member).getFiltered(UNHANDLED) ?? [];
      const found = sub.find((symbol) => symbol.isKind(SymbolKind.Table) && symbol.name === name);
      if (found) return found;
    }
    if (member.isKind(SymbolKind.Table) && member.name === name) return member;
  }
  return undefined;
}

export function canonicalName (compiler: Compiler, path: string, tableName: string): CanonicalName | undefined {
  const table = findTable(compiler, path, tableName);
  if (!table) return undefined;
  return compiler.canonicalName(filepath(path), table.originalSymbol).getValue();
}
