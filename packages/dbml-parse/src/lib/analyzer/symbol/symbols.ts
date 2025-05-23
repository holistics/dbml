/* eslint-disable max-classes-per-file */
import SymbolTable from './symbolTable';
import { SyntaxNode } from '../../parser/nodes';

export type NodeSymbolId = number;
export class NodeSymbolIdGenerator {
  private id = 0;

  reset () {
    this.id = 0;
  }

  nextId (): NodeSymbolId {
    // eslint-disable-next-line no-plusplus
    return this.id++;
  }
}

// A Symbol contains metadata about an entity (Enum, Table, etc.)
// This does not include `name` as an entity may have multiple names (e.g alias)
export interface NodeSymbol {
  id: NodeSymbolId;
  symbolTable?: SymbolTable;
  declaration?: SyntaxNode;
  references: SyntaxNode[];
  injectorDeclaration?: SyntaxNode;
}

// A symbol for a schema, contains the schema's symbol table
export class SchemaSymbol implements NodeSymbol {
  id: NodeSymbolId;

  symbolTable: SymbolTable;

  references: SyntaxNode[] = [];

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

  references: SyntaxNode[] = [];

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

  references: SyntaxNode[] = [];

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

  references: SyntaxNode[] = [];

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

  references: SyntaxNode[] = [];

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

  references: SyntaxNode[] = [];

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

  references: SyntaxNode[] = [];

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

  references: SyntaxNode[] = [];

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a table partial injection inside tables
export class TablePartialInjectionSymbol implements NodeSymbol {
  id: NodeSymbolId;

  declaration: SyntaxNode;

  references: SyntaxNode[] = [];

  constructor (
    { declaration }: { declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.declaration = declaration;
  }
}

// A symbol for a column field
export class TablePartialInjectedColumnSymbol implements NodeSymbol {
  id: NodeSymbolId;
  injectorDeclaration: SyntaxNode;
  injectorFieldSymbol: NodeSymbol;
  references: SyntaxNode[] = [];

  constructor ({ injectorFieldSymbol, injectorDeclaration }: { injectorFieldSymbol: NodeSymbol, injectorDeclaration: SyntaxNode }, id: NodeSymbolId) {
    this.id = id;
    this.injectorDeclaration = injectorDeclaration;
    this.injectorFieldSymbol = injectorFieldSymbol;
  }
}
