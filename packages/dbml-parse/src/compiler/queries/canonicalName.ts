import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  UNHANDLED,
} from '@/core/types/module';
import Report from '@/core/types/report';
import {
  type Filepath,
} from '@/core/types/filepath';
import {
  AliasSymbol, NodeSymbol, SchemaSymbol, SymbolKind, UseSymbol,
} from '@/core/types/symbol';
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
  if (original.filepath.intern() === filepath.intern()) {
    return Report.create(fullnameToCanonical(this, original));
  }

  // 2. Look for a UseSymbol or AliasSymbol in this file's scope that points at the same original
  const ast = this.parseFile(filepath).getValue().ast;
  const programSymbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!programSymbol) return Report.create(fullnameToCanonical(this, original));

  const members = this.symbolMembers(programSymbol).getFiltered(UNHANDLED) ?? [];

  // Also check schema members (elements live inside schemas)
  const allMembers: NodeSymbol[] = [
    ...members,
  ];
  for (const m of members) {
    if (m instanceof SchemaSymbol && m.isKind(SymbolKind.Schema)) {
      const sub = this.symbolMembers(m).getFiltered(UNHANDLED);
      if (sub) allMembers.push(...sub);
    }
  }

  // Find first UseSymbol/AliasSymbol pointing at same original in this file
  for (const m of allMembers) {
    if (m.filepath.intern() !== filepath.intern()) continue;
    if (m.originalSymbol !== original) continue;

    if (m instanceof UseSymbol || m instanceof AliasSymbol) {
      const name = m.name;
      if (!name) continue;
      const isRenamed = name !== original.name;
      if (isRenamed) {
        // Aliased import  -- strip schema
        return Report.create({
          schema: '',
          name,
        });
      }
      // Non-aliased import  -- preserve original schema
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
  }

  // 3. Fallback: original name
  return Report.create(fullnameToCanonical(this, original));
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
