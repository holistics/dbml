import SymbolTable from './symbolTable';
import { SyntaxNode } from '@/core/types/nodes';
import { Filepath } from '@/core/types/filepath';
import { DEFAULT_ENTRY } from '@/constants';
import { SymbolKind } from './symbolIndex';

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
  kind: SymbolKind;
  filepath: Filepath;
  symbolTable?: SymbolTable;
  declaration?: SyntaxNode;
  references: SyntaxNode[] = [];

  constructor (
    {
      kind,
      declaration,
      symbolTable,
      filepath,
    }: {
      kind: SymbolKind;
      declaration?: SyntaxNode;
      symbolTable?: SymbolTable;
      filepath?: Filepath;
    },
    id: NodeSymbolId,
  ) {
    this.id = id;
    this.kind = kind;
    this.declaration = declaration;
    this.symbolTable = symbolTable;
    this.filepath = filepath ?? declaration?.filepath ?? DEFAULT_ENTRY;
  }

  isKind (kind: SymbolKind): boolean {
    return this.kind === kind;
  }
}

// A symbol for a schema, contains the schema's symbol table
export class SchemaSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;

  constructor ({ symbolTable }: { symbolTable: SymbolTable }, id: NodeSymbolId) {
    super({ kind: SymbolKind.Schema, symbolTable }, id);
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
    super({
      kind: SymbolKind.Enum, symbolTable, declaration,
    }, id);
  }
}

// A symbol for an enum field
export class EnumFieldSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    super({ kind: SymbolKind.EnumField, declaration }, id);
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
    super({
      kind: SymbolKind.Table, symbolTable, declaration,
    }, id);
  }
}

// A symbol for a column field
export class ColumnSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    super({ kind: SymbolKind.Column, declaration }, id);
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
    super({
      kind: SymbolKind.TableGroup, symbolTable, declaration,
    }, id);
  }
}

// A symbol for a tablegroup field
export class TableGroupFieldSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    super({ kind: SymbolKind.TableGroupField, declaration }, id);
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
    super({
      kind: SymbolKind.TablePartial, symbolTable, declaration,
    }, id);
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
    super({
      kind: SymbolKind.PartialInjection, symbolTable, declaration,
    }, id);
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
    super({ kind: SymbolKind.Column, declaration }, id);
    this.tablePartialSymbol = tablePartialSymbol;
  }
}

// A symbol for a DiagramView block
export class DiagramViewSymbol extends NodeSymbol {
  declare symbolTable: SymbolTable;
  declare declaration: SyntaxNode;
  declare filepath: Filepath;

  constructor (
    { symbolTable, declaration }: { symbolTable: SymbolTable; declaration: SyntaxNode },
    id: NodeSymbolId,
  ) {
    super({
      kind: SymbolKind.DiagramView, symbolTable, declaration,
    }, id);
  }
}

// A symbol for a DiagramView field (table/note/group/schema reference)
export class DiagramViewFieldSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;
  declare filepath: Filepath;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    super({ kind: SymbolKind.DiagramViewField, declaration }, id);
  }
}

// A symbol for a sticky note
export class StickyNoteSymbol extends NodeSymbol {
  declare declaration: SyntaxNode;
  declare filepath: Filepath;

  constructor ({ declaration }: { declaration: SyntaxNode }, id: NodeSymbolId) {
    super({ kind: SymbolKind.StickyNote, declaration }, id);
  }
}
