// Used to index a symbol table to obtain a symbol
export type NodeSymbolId = string;

export function createSchemaSymbolId(key: string): NodeSymbolId {
  return `Schema:${key}`;
}

export function createTableSymbolId(key: string): NodeSymbolId {
  return `Table:${key}`;
}

export function createColumnSymbolId(key: string): NodeSymbolId {
  return `Column:${key}`;
}

export function createEnumSymbolId(key: string): NodeSymbolId {
  return `Enum:${key}`;
}

export function createEnumFieldSymbolId(key: string): NodeSymbolId {
  return `Enum field:${key}`;
}

export function createTableGroupSymbolId(key: string): NodeSymbolId {
  return `TableGroup:${key}`;
}

export function TableGroupFieldSymbolId(key: string): NodeSymbolId {
  return `Tablegroup field:${key}`;
}

export function destructureId(id: NodeSymbolId): { name: string; type: string } {
  const [type, name] = id.split(':');

  return {
    name,
    type,
  };
}
