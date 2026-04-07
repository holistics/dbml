import { SyntaxNode } from '@/core/parser/nodes';
import type { Internable } from '@/core/types/internable';
import { Filepath } from './filepath';
import { ImportKind } from './keywords';

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
  TablePartialField = 'TablePartial field',
  PartialInjection = 'PartialInjection',

  Project = 'Project',
  ProjectField = 'Project field',

  Records = 'Records',

  Indexes = 'Indexes',
  IndexesField = 'Indexes field',

  Checks = 'Checks',

  Ref = 'Ref',

  Program = 'Program',

  Use = 'Use',
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
export class InjectedSymbol extends NodeSymbol {
  name: string;

  constructor (
    {
      kind,
      declaration,
      name,
    }: {
      kind: SymbolKind;
      declaration?: SyntaxNode;
      name: string;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({ kind, declaration }, id, filepath);
    this.name = name;
  }
}

export class SchemaSymbol extends NodeSymbol {
  name: string;
  parent?: SchemaSymbol;

  constructor (
    {
      name,
      parent,
    }: {
      name: string;
      parent?: SchemaSymbol;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({ kind: SymbolKind.Schema }, id, filepath);
    this.name = name;
    this.parent = parent;
  }

  get qualifiedName (): string[] {
    if (!this.parent) return [this.name];
    return [...this.parent.qualifiedName, this.name];
  }
}

export enum UseSpecifierPatternKind {
  Exact, // Selective use
  All, // *
}

// The item pattern
// e.g. use { <kind> <name> } from <filepath>
//            ^^^^^^^^^^^^^
//             pattern "Exact"
// e.g. use * from <filepath>
//          ^
//        pattern "All"
export type UseSpecifierPattern = {
  type: UseSpecifierPatternKind.Exact;
  importKind?: ImportKind;
  fullname?: string[]; // schema qualified name
} | {
  type: UseSpecifierPatternKind.All;
};

export class UseSymbol extends NodeSymbol {
  absolutePath?: Filepath;
  specifier: UseSpecifierPattern;

  constructor (
    {
      absolutePath,
      specifier,
    }: {
      absolutePath?: Filepath;
      specifier: UseSpecifierPattern;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({ kind: SymbolKind.Use }, id, filepath);
    this.absolutePath = absolutePath;
    this.specifier = specifier;
  }
}
