import { ElementKind } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import {
  type NodeSymbol, type ProgramSymbol, RefSymbol, SchemaSymbol, SymbolKind,
} from '@/core/types/symbol';
import { isElementNode } from '@/core/utils/validate';
import type Compiler from '../../index';

/** Top-level symbol kinds that can be named directly from a program */
export type VisibleSymbolKind =
  | SymbolKind.Schema
  | SymbolKind.Table
  | SymbolKind.Enum
  | SymbolKind.TableGroup
  | SymbolKind.StickyNote
  | SymbolKind.TablePartial
  | SymbolKind.DiagramView
  | SymbolKind.Ref;

/**
  * Symbols of `kind` whose names are usable from `program`.
  * - Scope kinds: the members of the program and its nested schemas, as-is (UseSymbol/AliasSymbol wrappers keep their local names)
  * - Ref: refs are not imported via `use`, a named ref is visible wherever it shows up in the output,
  *   i.e. its RefMetadata is owned by the program (the program reaches the ref's file and sees both endpoint tables)
  */
export function visibleSymbols (this: Compiler, program: ProgramSymbol, kind: VisibleSymbolKind): NodeSymbol[] {
  switch (kind) {
    case SymbolKind.Schema:
    case SymbolKind.Table:
    case SymbolKind.Enum:
    case SymbolKind.TableGroup:
    case SymbolKind.StickyNote:
    case SymbolKind.TablePartial:
    case SymbolKind.DiagramView:
      return scopeSymbols(this, program, kind);
    case SymbolKind.Ref:
      return reachableRefs(this, program);
    // Exhaustiveness checking
    default: {
      const _: never = kind;
      return [];
    }
  }
}

function scopeSymbols (compiler: Compiler, program: ProgramSymbol, kind: VisibleSymbolKind): NodeSymbol[] {
  // The program lists the public schema and also flattens its members => dedupe by identity
  const seen = new Set<NodeSymbol>();
  const result: NodeSymbol[] = [];

  const visit = (scope: NodeSymbol) => {
    for (const member of scope.members(compiler)) {
      if (seen.has(member)) continue;
      seen.add(member);
      if (member.isKind(kind)) result.push(member);
      if (member instanceof SchemaSymbol) visit(member);
    }
  };
  visit(program);

  return result;
}

function reachableRefs (compiler: Compiler, program: ProgramSymbol): RefSymbol[] {
  return compiler.reachableFiles(program.filepath).flatMap((filepath) => {
    const { ast } = compiler.parseFile(filepath).getValue();
    return ast.body.flatMap((node) => {
      if (!isElementNode(node, ElementKind.Ref)) return [];

      const symbol = compiler.nodeSymbol(node).getFiltered(UNHANDLED);
      if (!symbol?.isKind(SymbolKind.Ref)) return [];

      const refMetadata = compiler.nodeMetadata(node).getFiltered(UNHANDLED);
      if (!refMetadata?.owners(compiler).includes(program)) return [];

      return [symbol];
    });
  });
}
