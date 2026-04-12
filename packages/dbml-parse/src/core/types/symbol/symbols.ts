import { type SyntaxNode, UseDeclarationNode, type UseSpecifierNode, type WildcardNode } from '@/core/types/nodes';
import type { Internable } from '@/core/types/internable';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import type { Filepath } from '@/core/types/filepath';
import { ImportKind } from '@/core/types/keywords';
import SymbolTable from './symbolTable';

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
  DiagramViewField = 'DiagramView field',

  StickyNote = 'StickyNote',

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
  symbolTable?: SymbolTable;

  constructor ({
    kind,
    declaration,
    symbolTable,
  }: {
    kind: SymbolKind;
    declaration?: SyntaxNode;
    symbolTable?: SymbolTable;
  }, id: NodeSymbolId, filepath: Filepath) {
    this.id = id;
    this.kind = kind;
    this.declaration = declaration;
    this.filepath = filepath;
    this.symbolTable = symbolTable;
  }

  // Whether this symbol can be imported from other files
  get canBeImported (): boolean {
    return true;
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

export class UseSymbol extends NodeSymbol {
  useSpecifierDeclaration?: UseSpecifierNode | WildcardNode;
  usedSymbol?: NodeSymbol;

  constructor ({
    kind,
    declaration,
    useSpecifierDeclaration,
    usedSymbol,
  }: {
    kind: SymbolKind;
    declaration?: SyntaxNode;
    useSpecifierDeclaration?: UseSpecifierNode | WildcardNode;
    usedSymbol?: NodeSymbol;
  }, id: NodeSymbolId, filepath: Filepath) {
    super({ kind, declaration }, id, filepath);
    this.useSpecifierDeclaration = useSpecifierDeclaration;
    this.usedSymbol = usedSymbol;
  }

  get canBeImported (): boolean {
    const useDeclaration = this.useSpecifierDeclaration?.parentOfKind(UseDeclarationNode);
    return !useDeclaration || useDeclaration.isReuse;
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
  declare kind: SymbolKind.Schema;
  declare symbolTable: SymbolTable;
  name: string;
  parent?: SchemaSymbol;

  constructor (
    {
      name,
      parent,
      symbolTable,
    }: {
      name?: string;
      parent?: SchemaSymbol;
      symbolTable?: SymbolTable;
    },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({ kind: SymbolKind.Schema, symbolTable }, id, filepath);
    this.name = name ?? '';
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

// A symbol for an enum, contains the enum's symbol table
// which is used to hold all the enum field symbols of the enum
export class EnumSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    {
      symbolTable, declaration,
    }: { symbolTable: SymbolTable;
      declaration: SyntaxNode; },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Enum,
      symbolTable,
      declaration,
    }, id, filepath);
  }
}

// A symbol for an enum field
export class EnumFieldSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId, filepath: Filepath) {
    super({
      kind: SymbolKind.EnumField,
      declaration,
    }, id, filepath);
  }
}

// A symbol for a table, contains the table's symbol table
// which is used to hold all the column and table partial symbols of the table
export class TableSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    {
      symbolTable, declaration,
    }: { symbolTable: SymbolTable;
      declaration: SyntaxNode; },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Table,
      symbolTable,
      declaration,
    }, id, filepath);
  }
}

// A symbol for a column field
export class ColumnSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId, filepath: Filepath) {
    super({
      kind: SymbolKind.Column,
      declaration,
    }, id, filepath);
  }
}

// A symbol for a tablegroup, contains the symbol table for the tablegroup
// which is used to hold all the symbols of the table group fields
export class TableGroupSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    {
      symbolTable, declaration,
    }: { symbolTable: SymbolTable;
      declaration: SyntaxNode; },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.TableGroup,
      symbolTable,
      declaration,
    }, id, filepath);
  }
}

// A symbol for a tablegroup field
export class TableGroupFieldSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId, filepath: Filepath) {
    super({
      kind: SymbolKind.TableGroupField,
      declaration,
    }, id, filepath);
  }
}

// A symbol for a table partial, contains the table partial's symbol table
// which is used to hold all the column symbols of the table partial
export class TablePartialSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    {
      symbolTable, declaration,
    }: { symbolTable: SymbolTable;
      declaration: SyntaxNode; },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.TablePartial,
      symbolTable,
      declaration,
    }, id, filepath);
  }
}

// A member symbol for a Table injecting a TablePartial
export class PartialInjectionSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    {
      symbolTable, declaration,
    }: { symbolTable: SymbolTable;
      declaration: SyntaxNode; },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.PartialInjection,
      symbolTable,
      declaration,
    }, id, filepath);
  }
}

// A symbol for a column injected from a TablePartial
export class TablePartialInjectedColumnSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;
  tablePartialSymbol: TablePartialSymbol;

  constructor (
    {
      declaration, tablePartialSymbol,
    }: { declaration: SyntaxNode;
      tablePartialSymbol: TablePartialSymbol; },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.Column,
      declaration,
    }, id, filepath);
    this.tablePartialSymbol = tablePartialSymbol;
  }
}

// A symbol for a DiagramView block
export class DiagramViewSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    {
      symbolTable, declaration,
    }: { symbolTable: SymbolTable;
      declaration: SyntaxNode; },
    id: NodeSymbolId,
    filepath: Filepath,
  ) {
    super({
      kind: SymbolKind.DiagramView,
      symbolTable,
      declaration,
    }, id, filepath);
  }
}

// A symbol for a DiagramView field (table/note/group/schema reference)
export class DiagramViewFieldSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId, filepath: Filepath) {
    super({
      kind: SymbolKind.DiagramViewField,
      declaration,
    }, id, filepath);
  }
}

// A symbol for a sticky note
export class StickyNoteSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId, filepath: Filepath) {
    super({
      kind: SymbolKind.StickyNote,
      declaration,
    }, id, filepath);
  }
}
