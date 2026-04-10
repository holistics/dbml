import { ElementDeclarationNode, SyntaxNode } from '@/core/types/nodes';
import type { Internable } from '@/core/types/internable';
import { DEFAULT_SCHEMA_NAME } from '@/constants';

export enum SymbolKind {
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

  DiagramView = 'DiagramView',

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

  constructor ({
    kind,
    declaration,
  }: {
    kind: SymbolKind;
    declaration?: SyntaxNode;
  }, id: NodeSymbolId) {
    this.id = id;
    this.kind = kind;
    this.declaration = declaration;
  }

  intern (): InternedNodeSymbol {
    return `symbol@${this.id}` as InternedNodeSymbol;
  }

  isKind (...kinds: SymbolKind[]): boolean {
    return kinds.includes(this.kind);
  }

  isPublicSchema (): this is SchemaSymbol {
    return false;
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
  ) {
    super({ kind, declaration }, id);
    this.injectionDeclaration = injectionDeclaration;
    this.name = name;
  }
}

export class SchemaSymbol extends NodeSymbol {
  declare kind: SymbolKind.Schema;
  name: string;
  parent?: SchemaSymbol;

  constructor ({ name, parent }: { name: string; parent?: SchemaSymbol }, id: NodeSymbolId) {
    super({ kind: SymbolKind.Schema }, id);
    this.name = name;
    this.parent = parent;
  }

  get qualifiedName (): string[] {
    if (!this.parent) return [this.name];
    return [...this.parent.qualifiedName, this.name];
  }

  override isPublicSchema (): this is SchemaSymbol {
    return this.qualifiedName.join('.') === DEFAULT_SCHEMA_NAME;
  }
}
