// Used to index a symbol table to obtain a symbol
export type NodeSymbolIndex = string;

export function createSchemaSymbolIndex(key: string): NodeSymbolIndex {
  return `Schema:${key}`;
}

export function createTableSymbolIndex(key: string): NodeSymbolIndex {
  return `Table:${key}`;
}

export function createColumnSymbolIndex(key: string): NodeSymbolIndex {
  return `Column:${key}`;
}

export function createEnumSymbolIndex(key: string): NodeSymbolIndex {
  return `Enum:${key}`;
}

export function createEnumFieldSymbolIndex(key: string): NodeSymbolIndex {
  return `Enum field:${key}`;
}

export function createTableGroupSymbolIndex(key: string): NodeSymbolIndex {
  return `TableGroup:${key}`;
}

export function TableGroupFieldSymbolIndex(key: string): NodeSymbolIndex {
  return `Tablegroup field:${key}`;
}

export function destructureIndex(id: NodeSymbolIndex): { name: string; type: string } {
  const [type, name] = id.split(':');

  return {
    name,
    type,
  };
}

export function isPublicSchemaIndex(id: NodeSymbolIndex): boolean {
  const { type, name } = destructureIndex(id);

  return type === 'Schema' && name === 'public';
}
