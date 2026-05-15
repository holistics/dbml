import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { UNHANDLED } from '@/core/types/module';
import Report from '@/core/types/report';
import { type Filepath } from '@/core/types/filepath';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbol';
import type Compiler from '../index';

export interface CanonicalName {
  schema: string;
  name: string;
}

// Canonical name of a symbol as seen from a specific file.
// Priority: real name (if declared in that file) > first use alias > first alias > original name.
export function canonicalName (this: Compiler, filepath: Filepath, symbol: NodeSymbol): Report<CanonicalName | undefined> {
  const original = symbol.originalSymbol;

  // 1. If symbol is declared in this file, use its fullname directly
  if (original.filepath.equals(filepath)) {
    return Report.create(fullnameToCanonical(this, original));
  }

  // 2. Find UseSymbol/AliasSymbol in this file pointing at the same original
  const candidates = [
    ...this.symbolUses(original).getValue(),
    ...this.symbolAliases(original).getValue(),
  ].filter((m) => m.filepath.equals(filepath));

  for (const member of candidates) {
    const name = member.name;
    if (!name) continue;
    if (name !== original.name) {
      return Report.create({
        schema: '',
        name,
      });
    }
    const schemaChain = getSchemaChain(this, member);
    if (schemaChain.length > 0) {
      return Report.create({
        schema: schemaChain.join('.'),
        name,
      });
    }
    const originalCanonical = fullnameToCanonical(this, original);
    if (originalCanonical) return Report.create({
      ...originalCanonical,
      name,
    });
    return Report.create({
      schema: DEFAULT_SCHEMA_NAME,
      name,
    });
  }

  // 3. Fallback: original name
  return Report.create(fullnameToCanonical(this, original));
}

// Walk up symbolParent chain to build the schema qualified name, excluding public
function getSchemaChain (compiler: Compiler, symbol: NodeSymbol): string[] {
  const chain: string[] = [];
  let cur: NodeSymbol | undefined = symbol;
  while (cur) {
    const parents = compiler.symbolParent(cur);
    const schemaParent = parents.find(
      (p): p is SchemaSymbol => p instanceof SchemaSymbol && p.isKind(SymbolKind.Schema),
    );
    if (!schemaParent || schemaParent.isPublicSchema()) break;
    chain.unshift(schemaParent.name ?? '');
    cur = schemaParent;
  }
  return chain;
}

function fullnameToCanonical (compiler: Compiler, symbol: NodeSymbol): CanonicalName | undefined {
  if (!symbol.declaration) return symbol.name
    ? {
        schema: DEFAULT_SCHEMA_NAME,
        name: symbol.name,
      }
    : undefined;
  const fullname = compiler.nodeFullname(symbol.declaration).getFiltered(UNHANDLED);
  if (!fullname || fullname.length === 0) return symbol.name
    ? {
        schema: DEFAULT_SCHEMA_NAME,
        name: symbol.name,
      }
    : undefined;

  const name = fullname[fullname.length - 1];
  const schema = fullname.length > 1 ? fullname.slice(0, -1).join('.') : DEFAULT_SCHEMA_NAME;
  return {
    schema,
    name,
  };
}
