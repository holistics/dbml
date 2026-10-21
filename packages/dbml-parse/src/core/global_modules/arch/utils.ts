import type Compiler from '@/compiler';
import { builtinKindName, isReserved } from '@/core/arch/vocabulary';
import { handleOf } from '@/core/arch/read';
import type { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { ElementDeclarationNode } from '@/core/types/nodes';
import { type NodeSymbol, SymbolKind, UseSymbol } from '@/core/types/symbol';
import { getDefaultSchemaSymbol, getProgramSymbol } from '../utils';

// An element or kind visible in a file, declared there or imported
export function lookupVisible (compiler: Compiler, filepath: Filepath, kind: SymbolKind, name: string): NodeSymbol | undefined {
  const program = getProgramSymbol(compiler, filepath);
  if (!program) return undefined;
  const publicSchema = getDefaultSchemaSymbol(compiler, program);
  return (publicSchema && compiler.lookupMembers(publicSchema, kind, name)) ?? compiler.lookupMembers(program, kind, name);
}

// Roles a file can use, by lowercased word. A `Kind` declared in the file overrules an imported one, and a later one an earlier one.
export function visibleKinds (compiler: Compiler, filepath: Filepath): Map<string, NodeSymbol> {
  const kinds = new Map<string, NodeSymbol>();
  const program = getProgramSymbol(compiler, filepath);
  if (!program) return kinds;
  const publicSchema = getDefaultSchemaSymbol(compiler, program);
  if (!publicSchema) return kinds;

  const members = (compiler.symbolMembers(publicSchema).getFiltered(UNHANDLED) ?? [])
    .filter((m) => m.isKind(SymbolKind.Kind) && m.name !== undefined && !isReserved(m.name));
  for (const member of [
    ...members.filter((m) => m instanceof UseSymbol),
    ...members.filter((m) => !(m instanceof UseSymbol)),
  ]) {
    kinds.set(member.name!.toLowerCase(), member);
  }
  return kinds;
}

// The role a word names in a file: its declared spelling, or undefined when it is not a role
export function resolveRole (compiler: Compiler, filepath: Filepath, word: string): string | undefined {
  const declared = visibleKinds(compiler, filepath).get(word.toLowerCase());
  if (declared) return declared.originalSymbol.name;
  return builtinKindName(word);
}

// How links and groups name an element in the model: the handle it was declared with. A sticky note
// is named in the model by its name in this file (`use { Note memo as m }` gives `m`), so it is named the same way here.
export function originalHandle (compiler: Compiler, symbol: NodeSymbol, filepath: Filepath): string | undefined {
  const original = symbol.originalSymbol;
  if (original.isKind(SymbolKind.StickyNote)) return original.interpretedName(compiler, filepath).name;
  const declaration = original.declaration;
  return declaration instanceof ElementDeclarationNode ? handleOf(declaration) : undefined;
}
