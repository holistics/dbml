import SymbolTable from './symbolTable';
import { SyntaxNode } from '@/core/parser/nodes';
import { Filepath } from '@/core/types/filepath';
import { DEFAULT_ENTRY } from '@/constants';

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
export class NodeSymbol {
  id: NodeSymbolId;
  filepath: Filepath;
  symbolTable?: SymbolTable;
  declaration?: SyntaxNode;
  references: SyntaxNode[] = [];

  constructor (
    {
      declaration,
      symbolTable,
      filepath,
    }: {
      declaration?: SyntaxNode;
      symbolTable?: SymbolTable;
      filepath?: Filepath;
    },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.declaration = declaration;
    this.symbolTable = symbolTable;
    this.filepath = filepath ?? declaration?.filepath ?? DEFAULT_ENTRY;
  }
}

// A symbol for a schema, contains the schema's symbol table
export class SchemaSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;

  constructor ({ symbolTable }: { symbolTable: SymbolTable }, id: NodeSymbolId) {
    super({ symbolTable }, id);
  }
}

// A symbol for an enum, contains the enum's symbol table
// which is used to hold all the enum field symbols of the enum
export class EnumSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super({ symbolTable, declaration }, id);
  }
}

// A symbol for an enum field
export class EnumFieldSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    super({ declaration }, id);
  }
}

// A symbol for a table, contains the table's symbol table
// which is used to hold all the column and table partial symbols of the table
export class TableSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super({ symbolTable, declaration }, id);
  }
}

// A symbol for a column field
export class ColumnSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    super({ declaration }, id);
  }
}

// A symbol for a tablegroup, contains the symbol table for the tablegroup
// which is used to hold all the symbols of the table group fields
export class TableGroupSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super({ symbolTable, declaration }, id);
  }
}

// A symbol for a tablegroup field
export class TableGroupFieldSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    super({ declaration }, id);
  }
}

// A symbol for a table partial, contains the table partial's symbol table
// which is used to hold all the column symbols of the table partial
export class TablePartialSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super({ symbolTable, declaration }, id);
  }
}

// A member symbol for a Table injecting a TablePartial
export class PartialInjectionSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super({ symbolTable, declaration }, id);
  }
}

// A symbol for a column injected from a TablePartial
export class TablePartialInjectedColumnSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;
  tablePartialSymbol: TablePartialSymbol;

  constructor (
    { declaration, tablePartialSymbol }: { declaration: SyntaxNode; tablePartialSymbol: TablePartialSymbol },
    id: NodeSymbolId,
  ) {
    super({ declaration }, id);
    this.tablePartialSymbol = tablePartialSymbol;
  }
}
