import {
  NodeSymbolIndex,
  createColumnSymbolIndex,
  createEnumFieldSymbolIndex,
  createEnumSymbolIndex,
  createSchemaSymbolIndex,
  createTableGroupFieldSymbolIndex,
  createTableGroupSymbolIndex,
  createTableSymbolIndex,
} from './symbolIndex';
import SymbolTable from './symbolTable';
import {
  ColumnSymbol,
  EnumFieldSymbol,
  EnumSymbol,
  NodeSymbol,
  TableGroupFieldSymbol,
  TableGroupSymbol,
  TableSymbol,
} from './symbols';

// Given `name`, generate indexes with `name` and all possible kind
// e.g `Schema:name`, `Table:name`, etc.
export function generatePossibleIndexes(name: string): NodeSymbolIndex[] {
  return [
    createSchemaSymbolIndex,
    createTableSymbolIndex,
    createEnumSymbolIndex,
    createTableGroupSymbolIndex,
    createColumnSymbolIndex,
    createEnumFieldSymbolIndex,
    createTableGroupFieldSymbolIndex,
  ].map((f) => f(name));
}
