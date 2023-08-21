import SymbolTable from './symbolTable';
import { SyntaxNode } from '../../parser/nodes';

export interface NodeSymbol {
  symbolTable?: SymbolTable;
  declaration?: SyntaxNode;
  references: SyntaxNode[];
}

// A symbol for a schema, contains the schema's symbol table
export class SchemaSymbol implements NodeSymbol {
  symbolTable: SymbolTable;

  references: SyntaxNode[] = [];

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
  }
}

// A symbol for an enum, contains the enum's symbol table
// which is used to hold all the enum field symbols of the enum
export class EnumSymbol implements NodeSymbol {
  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  references: SyntaxNode[] = [];

  constructor(symbolTable: SymbolTable, declaration: SyntaxNode) {
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for an enum field
export class EnumFieldSymbol implements NodeSymbol {
  declaration: SyntaxNode;

  references: SyntaxNode[] = [];

  constructor(declaration: SyntaxNode) {
    this.declaration = declaration;
  }
}

// A symbol for a table, contains the table's symbol table
// which is used to hold all the column symbols of the table
export class TableSymbol implements NodeSymbol {
  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  references: SyntaxNode[] = [];

  constructor(symbolTable: SymbolTable, declaration: SyntaxNode) {
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a column field
export class ColumnSymbol implements NodeSymbol {
  declaration: SyntaxNode;

  references: SyntaxNode[] = [];

  constructor(declaration: SyntaxNode) {
    this.declaration = declaration;
  }
}

// A symbol for a tablegroup, contains the symbol table for the tablegroup
// which is used to hold all the symbols of the table group fields
export class TableGroupSymbol implements NodeSymbol {
  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  references: SyntaxNode[] = [];

  constructor(symbolTable: SymbolTable, declaration: SyntaxNode) {
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a tablegroup field
export class TableGroupFieldSymbol implements NodeSymbol {
  declaration: SyntaxNode;

  references: SyntaxNode[] = [];

  constructor(declaration: SyntaxNode) {
    this.declaration = declaration;
  }
}
