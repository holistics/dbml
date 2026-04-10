import { ElementDeclarationNode, SyntaxNode } from '@/core/parser/nodes';
import type { Internable } from '@/core/types/internable';
import { Filepath } from '@/core/types/filepath';

export const enum SymbolKind {
  Schema = 'Schema',

  Table = 'Table',
  Column = 'Column',

  TableGroup = 'TableGroup',
  TableGroupField = 'TableGroup field',

  Enum = 'Enum',
  EnumField = 'Enum field',

  Note = 'Note',

  TablePartial = 'TablePartial',
  PartialInjection = 'PartialInjection',

  Indexes = 'Indexes',
  IndexesField = 'Indexes field',

  Program = 'Program',
}

declare const __nodeSymbolBrand: unique symbol;
export type NodeSymbolId = number & { readonly [__nodeSymbolBrand]: true };

declare const __internedNodeSymbolBrand: unique symbol;
export type InternedNodeSymbol = string & { readonly [__internedNodeSymbolBrand]: true };

export class NodeSymbolIdGenerator {
  private id = 0;

  reset () {
    this.id = 0;
  }

  nextId (): NodeSymbolId {
    return this.id++ as NodeSymbolId;
  }
}

export class NodeSymbol implements Internable<InternedNodeSymbol> {
  id: NodeSymbolId;
  kind: SymbolKind;
  declaration?: SyntaxNode;
  filepath: Filepath;

  constructor ({
    kind,
    declaration,
  }: {
    kind: SymbolKind;
    declaration?: SyntaxNode;
  }, id: NodeSymbolId, filepath: Filepath) {
    this.id = id;
    this.kind = kind;
    this.declaration = declaration;
    this.filepath = filepath;
  }

  intern (): InternedNodeSymbol {
    return `symbol@${this.filepath.intern()}:${this.id}` as InternedNodeSymbol;
  }

  isKind (...kinds: SymbolKind[]): boolean {
    return kinds.includes(this.kind);
  }
}

// A symbol injected from another scope (e.g. partial-injected columns).
// Carries its own name to avoid fullname(declaration) lookups which would resolve
// against the original scope, not the injection target.
export class InjectedColumnSymbol extends NodeSymbol {
  name: string;
  injectionDeclaration: SyntaxNode;

  constructor (
    {
      kind,
      declaration,
      name,
      injectionDeclaration,
    }: {
      kind: SymbolKind;
      declaration: SyntaxNode;
      injectionDeclaration: SyntaxNode;
      name: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({ kind, declaration }, id, filepath);
    this.injectionDeclaration = injectionDeclaration;
    this.name = name;
  }
}

export class SchemaSymbol extends NodeSymbol {
  name: string;
  parent?: SchemaSymbol;

  constructor ({ name, parent }: { name: string; parent?: SchemaSymbol }, id: NodeSymbolId, filepath: Filepath) {
    super({ kind: SymbolKind.Schema }, id, filepath);
    this.name = name;
    this.parent = parent;
  }

  get qualifiedName (): string[] {
    if (!this.parent) return [this.name];
    return [...this.parent.qualifiedName, this.name];
  }
}
