import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  Internable,
} from '@/core/types/internable';
import {
  ImportKind,
} from '@/core/types/keywords';
import {
  type SyntaxNode, UseDeclarationNode, type UseSpecifierNode, type WildcardNode,
  ProgramNode,
  ElementDeclarationNode,
} from '@/core/types/nodes';

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

  DiagramView = 'DiagramView',
  DiagramViewTopLevelWildcard = 'DiagramView top-level wildcard',
  DiagramViewTable = 'DiagramView table',
  DiagramViewTableGroup = 'DiagramView tablegroup',
  DiagramViewNote = 'DiagramView note',
  DiagramViewSchema = 'DiagramView schema',

  Program = 'Program',
}

export function convertImportKindToSymbolKind (importKind: ImportKind): SymbolKind {
  switch (importKind) {
    case ImportKind.Table: return SymbolKind.Table;
    case ImportKind.Enum: return SymbolKind.Enum;
    case ImportKind.TableGroup: return SymbolKind.TableGroup;
    case ImportKind.TablePartial: return SymbolKind.TablePartial;
    case ImportKind.Note: return SymbolKind.Note;
    case ImportKind.Schema: return SymbolKind.Schema;
    default: {
      const _: never = importKind;
      throw new Error('Unreachable in convertImportKindToSymbolKind');
    }
  }
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
  name?: string;

  constructor ({
    kind,
    declaration,
    name,
  }: {
    kind: SymbolKind;
    declaration?: SyntaxNode;
    name?: string;
  }, id: NodeSymbolId, filepath: Filepath) {
    this.id = id;
    this.kind = kind;
    this.declaration = declaration;
    this.filepath = filepath;
    this.name = name;
  }

  // Whether this symbol can be imported from other files.
  // DiagramView is file-local: wildcard imports must not pull it in.
  get canBeImported (): boolean {
    return this.kind !== SymbolKind.DiagramView;
  }

  get originalSymbol (): NodeSymbol {
    return this;
  }

  // Return the filepath that defines the real symbol
  get originalFilepath (): Filepath {
    return this.originalSymbol.filepath;
  }

  intern (): InternedNodeSymbol {
    return `symbol@${this.filepath.intern()}:${this.id}` as InternedNodeSymbol;
  }

  isKind (...kinds: SymbolKind[]): boolean {
    return kinds.includes(this.kind);
  }

  isPublicSchema (): this is SchemaSymbol {
    return false;
  }

  isProgram (): boolean {
    return this.kind === SymbolKind.Program;
  }
}

export class AliasSymbol extends NodeSymbol {
  declare declaration: ElementDeclarationNode;
  declare name: string;
  aliasedSymbol: NodeSymbol;

  constructor ({
    kind,
    declaration,
    aliasedSymbol,
    name,
  }: {
    kind: SymbolKind;
    declaration?: ElementDeclarationNode;
    aliasedSymbol: NodeSymbol;
    name: string;
  }, id: NodeSymbolId, filepath: Filepath) {
    super({
      kind,
      declaration,
      name,
    }, id, filepath);
    this.aliasedSymbol = aliasedSymbol;
  }

  get canBeImported (): boolean {
    return this.aliasedSymbol.canBeImported;
  }

  get originalSymbol (): NodeSymbol {
    return this.aliasedSymbol.originalSymbol;
  }
}

export class UseSymbol extends NodeSymbol {
  useSpecifierDeclaration: UseSpecifierNode | WildcardNode | undefined;
  usedSymbol?: NodeSymbol;

  constructor ({
    kind,
    declaration,
    useSpecifierDeclaration,
    usedSymbol,
    name,
  }: {
    kind: SymbolKind;
    declaration?: SyntaxNode;
    useSpecifierDeclaration: UseSpecifierNode | WildcardNode | undefined;
    usedSymbol?: NodeSymbol;
    name?: string;
  }, id: NodeSymbolId, filepath: Filepath) {
    super({
      kind,
      declaration,
      name,
    }, id, filepath);
    this.useSpecifierDeclaration = useSpecifierDeclaration;
    this.usedSymbol = usedSymbol;
  }

  get canBeImported (): boolean {
    const useDeclaration = this.useSpecifierDeclaration?.parentOfKind(UseDeclarationNode);
    const isReuse = !useDeclaration || useDeclaration.isReuse;
    return isReuse && this.originalSymbol.canBeImported;
  }

  get originalSymbol (): NodeSymbol {
    if (!this.usedSymbol) return this;
    return this.usedSymbol.originalSymbol;
  }
}

// A symbol injected from another scope (e.g. partial-injected columns).
// Carries its own name to avoid fullname(declaration) lookups which would resolve
// against the original scope, not the injection target.
export class InjectedColumnSymbol extends NodeSymbol {
  declare name: string;
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
    super({
      kind,
      declaration,
    }, id, filepath);
    this.injectionDeclaration = injectionDeclaration;
    this.name = name;
  }
}

export class SchemaSymbol extends NodeSymbol {
  declare kind: SymbolKind.Schema;
  name: string;
  parent?: SchemaSymbol;

  constructor (
    {
      name,
      parent,
    }: {
      name?: string;
      parent?: SchemaSymbol;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Schema,
    }, id, filepath);
    this.name = name ?? '';
    this.parent = parent;
  }

  get qualifiedName (): string[] {
    if (!this.parent) return [
      this.name,
    ];
    return [
      ...this.parent.qualifiedName,
      this.name,
    ];
  }

  override isPublicSchema (): this is SchemaSymbol & { name: typeof DEFAULT_SCHEMA_NAME } {
    return this.qualifiedName.join('.') === DEFAULT_SCHEMA_NAME;
  }
}

export class ProgramSymbol extends NodeSymbol {
  declare kind: SymbolKind.Program;

  constructor (
    {
      declaration,
    }: {
      declaration: ProgramNode;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Program,
      declaration,
      name: filepath.absolute,
    }, id, filepath);
  }
}
