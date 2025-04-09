import {
  NodeSymbolIndex,
  createColumnSymbolIndex,
  createEnumFieldSymbolIndex,
  createEnumSymbolIndex,
  createSchemaSymbolIndex,
  createTableFragmentAsFieldSymbolIndex,
  createTableFragmentSymbolIndex,
  createTableGroupFieldSymbolIndex,
  createTableGroupSymbolIndex,
  createTableSymbolIndex,
} from './symbolIndex';

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
    createTableFragmentSymbolIndex,
    createTableFragmentAsFieldSymbolIndex,
  ].map((f) => f(name));
}
