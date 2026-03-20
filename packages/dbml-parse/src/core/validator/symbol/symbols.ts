import SymbolTable from './symbolTable';
import { type SyntaxNode } from '@/core/parser/nodes';
import { SymbolKind } from './symbolIndex';
import type { Filepath } from '@/compiler/projectLayout/filepath';

export type NodeSymbolId = number;
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
export interface NodeSymbol {
  id: NodeSymbolId;
  symbolTable?: SymbolTable;
  declaration?: SyntaxNode;
}

// A symbol for a schema, contains the schema's symbol table
export class SchemaSymbol implements NodeSymbol {
  id: NodeSymbolId;

  symbolTable: SymbolTable;

  // Filepaths of external files whose schema contents should be merged into this one
  externalFilepaths: Filepath[] = [];

  constructor ({ symbolTable }: { symbolTable: SymbolTable }, id: NodeSymbolId) {
    this.id = id;
    this.symbolTable = symbolTable;
  }
}

// A symbol for an enum, contains the enum's symbol table
// which is used to hold all the enum field symbols of the enum
export class EnumSymbol implements NodeSymbol {
  id: NodeSymbolId;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for an enum field
export class EnumFieldSymbol implements NodeSymbol {
  id: NodeSymbolId;

  declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    this.id = id;
    this.declaration = declaration;
  }
}

// A symbol for a table, contains the table's symbol table
// which is used to hold all the column and table partial symbols of the table
export class TableSymbol implements NodeSymbol {
  id: NodeSymbolId;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a column field
export class ColumnSymbol implements NodeSymbol {
  id: NodeSymbolId;

  declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    this.id = id;
    this.declaration = declaration;
  }
}

// A symbol for a tablegroup, contains the symbol table for the tablegroup
// which is used to hold all the symbols of the table group fields
export class TableGroupSymbol implements NodeSymbol {
  id: NodeSymbolId;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a tablegroup field
export class TableGroupFieldSymbol implements NodeSymbol {
  id: NodeSymbolId;

  declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    this.id = id;
    this.declaration = declaration;
  }
}

// A symbol for a table partial, contains the table partial's symbol table
// which is used to hold all the column symbols of the table partial
export class TablePartialSymbol implements NodeSymbol {
  id: NodeSymbolId;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for an element brought in via a `use` declaration from another file.
// `kind` records what type of symbol is expected (Table, Enum, TableGroup, TablePartial).
// `name` records the name of the expected symbol.
// `symbol` is initially undefined and is populated during the global resolution phase
// when the referenced file is merged in.
export class ExternalSymbol implements NodeSymbol {
  id: NodeSymbolId;

  declaration: SyntaxNode;

  kind: SymbolKind;

  name: string;

  externalFilepath: Filepath;

  constructor (
    { declaration, kind, name, externalFilepath }: { declaration: SyntaxNode; kind: SymbolKind; name: string; externalFilepath: Filepath },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.declaration = declaration;
    this.kind = kind;
    this.name = name;
    this.externalFilepath = externalFilepath;
  }
}

// A member symbol for a Table injecting a TablePartial
export class PartialInjectionSymbol implements NodeSymbol {
  id: NodeSymbolId;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a column field
export class TablePartialInjectedColumnSymbol implements NodeSymbol {
  id: NodeSymbolId;

  declaration: SyntaxNode;

  tablePartialSymbol: TablePartialSymbol;

  constructor ({ declaration, tablePartialSymbol }: { declaration: SyntaxNode; tablePartialSymbol: TablePartialSymbol }, id: NodeSymbolId) {
    this.id = id;
    this.declaration = declaration;
    this.tablePartialSymbol = tablePartialSymbol;
  }
}
