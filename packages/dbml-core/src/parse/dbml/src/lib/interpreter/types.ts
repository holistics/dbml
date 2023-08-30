import { Position } from '../types';

export interface TokenPosition {
  start: Position;
  end: Position;
}

export interface Database {
  schemas: [];
  tables: Table[];
  refs: Ref[];
  enums: Enum[];
  tableGroups: TableGroup[];
  aliases: Alias[];
  project: Project;
}

export interface Table {
  name: string;
  schemaName: null | string;
  alias: string | null;
  fields: Column[];
  indexes: Index[];
  token: TokenPosition;
  headerColor?: string;
  note?: {
    value: string;
    token: TokenPosition;
  };
}

export interface ColumnType {
  schemaName: string | null;
  type_name: string;
  args: string | null;
}

export interface Column {
  name: string;
  type: ColumnType;
  token: TokenPosition;
  inline_refs: InlineRef[];
  pk?: boolean;
  dbdefault?: {
    type: 'number' | 'string';
    value: number | string;
  };
  increment?: boolean;
  unique?: boolean;
  not_null?: boolean;
}

export interface Index {
  columns: {
    value: string;
    type: string;
  }[];
  token: TokenPosition;
  unique?: boolean;
  pk?: boolean;
  name?: string;
  note?: string;
  type?: string;
}

export interface InlineRef {
  schemaName: string | null;
  tableName: string;
  fieldNames: string[];
  relation: '>' | '<' | '-' | '<>';
  token: TokenPosition;
}

export interface Ref {
  schemaName: string | null;
  name: string | null;
  endpoints: RefEndpointPair;
  delete?: 'cascade' | 'no action' | 'restrict' | 'set default' | 'set null';
  update?: 'cascade' | 'no action' | 'restrict' | 'set default' | 'set null';
}

export type RefEndpointPair = [RefEndpoint, RefEndpoint];

export interface RefEndpoint {
  schemaName: string | null;
  tableName: string;
  fieldNames: string[];
  relation: RelationCardinality;
  token: TokenPosition;
}

export type RelationCardinality = '1' | '*';

export interface Enum {
  name: string;
  schemaName: string | null;
  token: TokenPosition;
  values: EnumField[];
}

export interface EnumField {
  name: string;
  token: TokenPosition;
  note?: string;
}

export interface TableGroup {
  name: string | null;
  schemaName: string | null;
  tables: TableGroupField[];
  token: TokenPosition;
}

export interface TableGroupField {
  name: string;
  schemaName: string | null;
}

export interface Alias {
  name: string;
  kind: string;
  value: {
    tableName: string;
    schemaName: string | null;
  };
}

export type Project =
  | Record<string, never>
  | {
      name: string | null;
      tables: Table[];
      refs: Ref[];
      enums: Enum[];
      tableGroups: TableGroup[];
      note: string | null;
      [
        index: string & Omit<any, 'name' | 'tables' | 'refs' | 'enums' | 'tableGroups' | 'note'>
      ]: string;
    };
