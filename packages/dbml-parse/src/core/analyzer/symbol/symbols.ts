import SymbolTable from './symbolTable';
import { type SyntaxNode } from '@/core/parser/nodes';
import { SymbolKind } from './symbolIndex';
import type { Filepath } from '@/compiler/projectLayout/filepath';
import type { Internable } from '@/core/internable';
import { InternedMap } from '@/core/internable';
import type { NodeToSymbolMap } from '@/core/analyzer/analyzer';

// Locally unique numeric id (unique within a file, not across files).
export type NodeSymbolId = number;

// Globally unique interned key for a symbol (filepath + local id).
declare const __nodeSymbolKeyBrand: unique symbol;
export type NodeSymbolKey = string & { [__nodeSymbolKeyBrand]: true };
export class NodeSymbolIdGenerator {
  private id = 0;

  reset () {
    this.id = 0;
  }

  nextId (): NodeSymbolId {
    return this.id++;
  }
}

// A Symbol contains metadata about an entity (Enum, Table, etc.)
// This does not include `name` as an entity may have multiple names (e.g alias)
export abstract class NodeSymbol implements Internable<NodeSymbolKey> {
  readonly id: NodeSymbolId;
  readonly filepath: Filepath;
  symbolTable?: SymbolTable;
  declaration?: SyntaxNode;

  constructor (id: NodeSymbolId, filepath: Filepath) {
    this.id = id;
    this.filepath = filepath;
  }

  intern (): NodeSymbolKey {
    return `${this.filepath.intern()}:${this.id}` as NodeSymbolKey;
  }

  isExternal (currentFilepath: Filepath): boolean {
    return !this.filepath.equals(currentFilepath);
  }
}

// A symbol for a schema, contains the schema's symbol table
export class SchemaSymbol extends NodeSymbol {
  symbolTable: SymbolTable;

  constructor ({ filepath, symbolTable }: { filepath: Filepath; symbolTable: SymbolTable }, id: NodeSymbolId) {
    super(id, filepath);
    this.symbolTable = symbolTable;
  }
}

// A symbol for an enum, contains the enum's symbol table
// which is used to hold all the enum field symbols of the enum
export class EnumSymbol extends NodeSymbol {
  symbolTable: SymbolTable;
  declaration: SyntaxNode;

  constructor (
    { filepath, symbolTable, declaration }: { filepath: Filepath; symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super(id, filepath);
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for an enum field
export class EnumFieldSymbol extends NodeSymbol {
  declaration: SyntaxNode;

  constructor ({ filepath, declaration }: { filepath: Filepath; declaration: SyntaxNode }, id: NodeSymbolId) {
    super(id, filepath);
    this.declaration = declaration;
  }
}

// A symbol for a table, contains the table's symbol table
// which is used to hold all the column and table partial symbols of the table
export class TableSymbol extends NodeSymbol {
  symbolTable: SymbolTable;
  declaration: SyntaxNode;

  constructor (
    { filepath, symbolTable, declaration }: { filepath: Filepath; symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super(id, filepath);
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a column field
export class ColumnSymbol extends NodeSymbol {
  declaration: SyntaxNode;

  constructor ({ filepath, declaration }: { filepath: Filepath; declaration: SyntaxNode }, id: NodeSymbolId) {
    super(id, filepath);
    this.declaration = declaration;
  }
}

// A symbol for a tablegroup, contains the symbol table for the tablegroup
// which is used to hold all the symbols of the table group fields
export class TableGroupSymbol extends NodeSymbol {
  symbolTable: SymbolTable;
  declaration: SyntaxNode;

  constructor (
    { filepath, symbolTable, declaration }: { filepath: Filepath; symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super(id, filepath);
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a tablegroup field
export class TableGroupFieldSymbol extends NodeSymbol {
  declaration: SyntaxNode;

  constructor ({ filepath, declaration }: { filepath: Filepath; declaration: SyntaxNode }, id: NodeSymbolId) {
    super(id, filepath);
    this.declaration = declaration;
  }
}

// A symbol for a sticky note (top-level named Note)
export class StickyNoteSymbol extends NodeSymbol {
  declaration: SyntaxNode;

  constructor ({ filepath, declaration }: { filepath: Filepath; declaration: SyntaxNode }, id: NodeSymbolId) {
    super(id, filepath);
    this.declaration = declaration;
  }
}

// A symbol for a table partial, contains the table partial's symbol table
// which is used to hold all the column symbols of the table partial
export class TablePartialSymbol extends NodeSymbol {
  symbolTable: SymbolTable;
  declaration: SyntaxNode;

  constructor (
    { filepath, symbolTable, declaration }: { filepath: Filepath; symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super(id, filepath);
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A member symbol for a Table injecting a TablePartial
export class PartialInjectionSymbol extends NodeSymbol {
  symbolTable: SymbolTable;
  declaration: SyntaxNode;

  constructor (
    { filepath, symbolTable, declaration }: { filepath: Filepath; symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super(id, filepath);
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a column field
export class TablePartialInjectedColumnSymbol extends NodeSymbol {
  declaration: SyntaxNode;
  tablePartialSymbol: TablePartialSymbol;

  constructor (
    { filepath, declaration, tablePartialSymbol }: { filepath: Filepath; declaration: SyntaxNode; tablePartialSymbol: TablePartialSymbol },
    id: NodeSymbolId,
  ) {
    super(id, filepath);
    this.declaration = declaration;
    this.tablePartialSymbol = tablePartialSymbol;
  }
}
