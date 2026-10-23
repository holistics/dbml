import type Compiler from '@/compiler';
import { handleOf } from '@/core/arch/read';
import type { Filepath } from '@/core/types/filepath';
import { ElementDeclarationNode } from '@/core/types/nodes';
import { type NodeSymbol, SymbolKind } from '@/core/types/symbol';
import { getDefaultSchemaSymbol, getProgramSymbol } from '../utils';

// An element visible in a file, declared there or imported
export function lookupVisible (compiler: Compiler, filepath: Filepath, kind: SymbolKind, name: string): NodeSymbol | undefined {
  const program = getProgramSymbol(compiler, filepath);
  if (!program) return undefined;
  const publicSchema = getDefaultSchemaSymbol(compiler, program);
  return (publicSchema && compiler.lookupMembers(publicSchema, kind, name)) ?? compiler.lookupMembers(program, kind, name);
}

// How links and groups name an element in the model: the handle it was declared with. A sticky note
// is named in the model by its name in this file (`use { Note memo as m }` gives `m`), so it is named the same way here.
export function originalHandle (compiler: Compiler, symbol: NodeSymbol, filepath: Filepath): string | undefined {
  const original = symbol.originalSymbol;
  if (original.isKind(SymbolKind.StickyNote)) return original.interpretedName(compiler, filepath).name;
  const declaration = original.declaration;
  return declaration instanceof ElementDeclarationNode ? handleOf(declaration) : undefined;
}
