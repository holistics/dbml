import {
  NodeSymbolIndex,
  SymbolKind,
  createColumnSymbolIndex,
  createEnumFieldSymbolIndex,
  createEnumSymbolIndex,
  createPartialInjectionSymbolIndex,
  createSchemaSymbolIndex,
  createTableGroupFieldSymbolIndex,
  createTableGroupSymbolIndex,
  createTablePartialSymbolIndex,
  createTableSymbolIndex,
} from './symbolIndex';
import {
  ColumnSymbol,
  NodeSymbol,
  TablePartialInjectedColumnSymbol,
  SchemaSymbol,
  TableGroupFieldSymbol,
  TableGroupSymbol,
  TableSymbol,
  EnumSymbol,
  EnumFieldSymbol,
  TablePartialSymbol,
  PartialInjectionSymbol,
} from './symbols';

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
  throw new Error('No other possible symbol kind in getSymbolKind');
}
