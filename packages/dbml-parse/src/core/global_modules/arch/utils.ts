import type Compiler from '@/compiler';
import { handleOf, roleOf } from '@/core/arch';
import { ARCH_NAME_PRECEDENCE } from '@/core/arch';
import type { Filepath } from '@/core/types/filepath';
import { ElementDeclarationNode } from '@/core/types/nodes';
import { type NodeSymbol, SymbolKind, UseSymbol } from '@/core/types/symbol';
import { getDefaultSchemaSymbol, getProgramSymbol } from '../utils';

// An element visible in a file, declared there or imported
export function lookupVisible (compiler: Compiler, filepath: Filepath, kind: SymbolKind, name: string): NodeSymbol | undefined {
  const program = getProgramSymbol(compiler, filepath);
  if (!program) return undefined;
  const publicSchema = getDefaultSchemaSymbol(compiler, program);
  return (publicSchema && compiler.lookupMembers(publicSchema, kind, name)) ?? compiler.lookupMembers(program, kind, name);
}

// The role an element, group or sticky note was declared with
export function getSymbolRole (symbol: NodeSymbol): string | undefined {
  const declaration = symbol.originalSymbol.declaration;
  return declaration instanceof ElementDeclarationNode ? roleOf(declaration) : undefined;
}

// Lower comes first; a role outside NAME_PRECEDENCE comes last
export function getRolePrecedence (role: string | undefined): number {
  const at = ARCH_NAME_PRECEDENCE.indexOf(role ?? '');
  return at < 0 ? ARCH_NAME_PRECEDENCE.length : at;
}

const symbolPrecedence = (symbol: NodeSymbol): number => getRolePrecedence(getSymbolRole(symbol));

// An alias is an identifier no other may share, whatever its role: `as` on the declaration, or on the import
export function isAliasSymbol (symbol: NodeSymbol): boolean {
  const declaration = symbol.originalSymbol.declaration;
  return (declaration instanceof ElementDeclarationNode && !!declaration.alias)
    || (symbol instanceof UseSymbol && symbol.name !== symbol.originalSymbol.name);
}

// Everything a name can mean in a file among `kinds`, declared there or imported, first by NAME_PRECEDENCE
export function getCandidates (compiler: Compiler, filepath: Filepath, name: string, kinds: SymbolKind[] = [SymbolKind.Element, SymbolKind.StickyNote]): NodeSymbol[] {
  const program = getProgramSymbol(compiler, filepath);
  if (!program) return [];
  const publicSchema = getDefaultSchemaSymbol(compiler, program);
  const found: NodeSymbol[] = [];
  for (const scope of [publicSchema, program]) {
    for (const symbol of (scope && compiler.symbolMembersLookupMap(scope).get(name)) ?? []) {
      if (!kinds.some((kind) => symbol.isKind(kind))) continue;
      if (found.some((other) => other.originalSymbol === symbol.originalSymbol)) continue;
      found.push(symbol);
    }
  }
  return found.sort((a, b) => symbolPrecedence(a) - symbolPrecedence(b));
}

// What a name means: the element with that role when one is written, else the first by NAME_PRECEDENCE
export function resolveName (compiler: Compiler, filepath: Filepath, name: string, role?: string, kinds?: SymbolKind[]): NodeSymbol | undefined {
  const candidates = getCandidates(compiler, filepath, name, kinds);
  return role ? candidates.find((symbol) => getSymbolRole(symbol) === role) : candidates[0];
}

// The name an element, group or sticky note goes by in a file: its handle there, or the name it was imported under
// (`use { Server api as api2 }` gives `api2`). Links and groups name their ends this way in the model.
export function getLocalHandle (compiler: Compiler, symbol: NodeSymbol, filepath: Filepath): string | undefined {
  const original = symbol.originalSymbol;
  if (original.isKind(SymbolKind.StickyNote)) return original.interpretedName(compiler, filepath).name;
  const declaration = original.declaration;
  if (!(declaration instanceof ElementDeclarationNode)) return undefined;
  return compiler.canonicalName(filepath, original).getValue()?.name ?? handleOf(declaration);
}
