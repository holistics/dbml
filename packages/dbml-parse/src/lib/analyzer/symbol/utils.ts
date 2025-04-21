import {
  NodeSymbolIndex,
  createColumnSymbolIndex,
  createEnumFieldSymbolIndex,
  createEnumSymbolIndex,
  createSchemaSymbolIndex,
  createTableGroupFieldSymbolIndex,
  createTableGroupSymbolIndex,
  createTablePartialInjectionSymbolIndex,
  createTablePartialSymbolIndex,
  createTableSymbolIndex,
} from './symbolIndex';
import {
  ColumnSymbol,
  NodeSymbol,
  TablePartialInjectedColumnSymbol,
} from './symbols';

// Given `name`, generate indexes with `name` and all possible kind
// e.g `Schema:name`, `Table:name`, etc.
export function generatePossibleIndexes (name: string): NodeSymbolIndex[] {
  return [
    createSchemaSymbolIndex,
    createTableSymbolIndex,
    createColumnSymbolIndex,
    createEnumSymbolIndex,
    createEnumFieldSymbolIndex,
    createTableGroupSymbolIndex,
    createTableGroupFieldSymbolIndex,
    createTablePartialSymbolIndex,
    createTablePartialInjectionSymbolIndex,
  ].map((f) => f(name));
}

export function getInjectedFieldSymbolFromInjectorFieldSymbol (injectorSymbol: NodeSymbol) {
  if (injectorSymbol instanceof ColumnSymbol) return TablePartialInjectedColumnSymbol;
  return null;
}
