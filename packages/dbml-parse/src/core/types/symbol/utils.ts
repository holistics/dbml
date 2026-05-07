import {
  ColumnSymbol,
  DiagramViewFieldSymbol,
  DiagramViewSymbol,
  EnumFieldSymbol,
  EnumSymbol,
  NodeSymbol,
  PartialInjectionSymbol,
  SchemaSymbol,
  StickyNoteSymbol,
  TableGroupFieldSymbol,
  TableGroupSymbol,
  TablePartialInjectedColumnSymbol,
  TablePartialSymbol,
  TableSymbol,
} from '@/core/types/symbol';
import {
  NodeSymbolIndex,
  SymbolKind,
  createColumnSymbolIndex,
  createDiagramViewFieldSymbolIndex,
  createDiagramViewSymbolIndex,
  createEnumFieldSymbolIndex,
  createEnumSymbolIndex,
  createPartialInjectionSymbolIndex,
  createSchemaSymbolIndex,
  createTableGroupFieldSymbolIndex,
  createTableGroupSymbolIndex,
  createTablePartialSymbolIndex,
  createTableSymbolIndex,
} from '@/core/types/symbol/symbolIndex';

// Given `name`, generate indexes with `name` and all possible kind
// e.g `Schema:name`, `Table:name`, etc.
export function generatePossibleIndexes (name: string): NodeSymbolIndex[] {
  return [
    createSchemaSymbolIndex,
    createTableSymbolIndex,
    createEnumSymbolIndex,
    createTableGroupSymbolIndex,
    createColumnSymbolIndex,
    createEnumFieldSymbolIndex,
    createTableGroupFieldSymbolIndex,
    createTablePartialSymbolIndex,
    createPartialInjectionSymbolIndex,
    createDiagramViewSymbolIndex,
    createDiagramViewFieldSymbolIndex,
  ].map((f) => f(name));
}

export function getSymbolKind (symbol: NodeSymbol): SymbolKind {
  if (symbol instanceof SchemaSymbol) {
    return SymbolKind.Schema;
  }
  if (symbol instanceof TableSymbol) {
    return SymbolKind.Table;
  }
  if (symbol instanceof ColumnSymbol) {
    return SymbolKind.Column;
  }
  if (symbol instanceof EnumSymbol) {
    return SymbolKind.Enum;
  }
  if (symbol instanceof EnumFieldSymbol) {
    return SymbolKind.EnumField;
  }
  if (symbol instanceof TableGroupSymbol) {
    return SymbolKind.TableGroup;
  }
  if (symbol instanceof TableGroupFieldSymbol) {
    return SymbolKind.TableGroupField;
  }
  if (symbol instanceof TablePartialSymbol) {
    return SymbolKind.TablePartial;
  }
  if (symbol instanceof TablePartialInjectedColumnSymbol) {
    return SymbolKind.Column;
  }
  if (symbol instanceof PartialInjectionSymbol) {
    return SymbolKind.PartialInjection;
  }
  if (symbol instanceof StickyNoteSymbol) {
    return SymbolKind.StickyNote;
  }
  if (symbol instanceof DiagramViewSymbol) {
    return SymbolKind.DiagramView;
  }
  if (symbol instanceof DiagramViewFieldSymbol) {
    return SymbolKind.DiagramViewField;
  }
  throw new Error('No other possible symbol kind in getSymbolKind');
}
