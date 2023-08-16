import SymbolTable from './symbolTable';
import { SyntaxNode } from '../../parser/nodes';

export enum SymbolKind {
  SCHEMA = 'Schema',
  TABLE = 'Table',
  ENUM = 'Enum',
  ENUM_MEMBER = 'Enum field',
  COLUMN = 'Column',
  TABLE_GROUP = 'TableGroup',
}

export interface NodeSymbol {
  kind: SymbolKind;
  symbolTable?: SymbolTable;
  declaration?: SyntaxNode;
}

// A symbol for a schema, contains the schema's symbol table
export class SchemaSymbol implements NodeSymbol {
  kind: SymbolKind.SCHEMA = SymbolKind.SCHEMA;

  symbolTable: SymbolTable;

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
  }
}

// A symbol for an enum, contains the enum's symbol table
// which is used to hold all the enum field symbols of the enum
export class EnumSymbol implements NodeSymbol {
  kind: SymbolKind.ENUM = SymbolKind.ENUM;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor(symbolTable: SymbolTable, declaration: SyntaxNode) {
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for an enum field
export class EnumFieldSymbol implements NodeSymbol {
  kind: SymbolKind.ENUM_MEMBER = SymbolKind.ENUM_MEMBER;

  declaration: SyntaxNode;

  constructor(declaration: SyntaxNode) {
    this.declaration = declaration;
  }
}

// A symbol for a table, contains the table's symbol table
// which is used to hold all the column symbols of the table
export class TableSymbol implements NodeSymbol {
  kind: SymbolKind.TABLE = SymbolKind.TABLE;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor(symbolTable: SymbolTable, declaration: SyntaxNode) {
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a column field
export class ColumnSymbol implements NodeSymbol {
  kind: SymbolKind.COLUMN = SymbolKind.COLUMN;

  declaration: SyntaxNode;

  constructor(declaration: SyntaxNode) {
    this.declaration = declaration;
  }
}

// A symbol for a tablegroup, contains the symbol table for the tablegroup
// which is used to hold all the symbols of the table group fields
export class TableGroupSymbol implements NodeSymbol {
  kind: SymbolKind.TABLE_GROUP = SymbolKind.TABLE_GROUP;

  symbolTable: SymbolTable;

  declaration: SyntaxNode;

  constructor(symbolTable: SymbolTable, declaration: SyntaxNode) {
    this.symbolTable = symbolTable;
    this.declaration = declaration;
  }
}

// A symbol for a tablegroup field
export class TableGroupFieldSymbol implements NodeSymbol {
  kind: SymbolKind.TABLE_GROUP = SymbolKind.TABLE_GROUP;

  declaration: SyntaxNode;

  constructor(declaration: SyntaxNode) {
    this.declaration = declaration;
  }
}
