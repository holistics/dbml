/* eslint-disable no-use-before-define */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ElementDeclarationNode } from '../parser/nodes';
import { Position } from '../types';
import { CompileError } from '../errors';

export interface TokenPosition {
  start: Position;
  end: Position;
}

export interface ElementInterpreter {
  interpret(): CompileError[];
}

export interface InterpreterDatabase {
  schema: [];
  tables: Map<ElementDeclarationNode, Table>;
  notes: Map<ElementDeclarationNode, Note>;
  // for keeping track of circular refs
  refIds: { [refid: string]: ElementDeclarationNode };
  ref: Map<ElementDeclarationNode, Ref>;
  enums: Map<ElementDeclarationNode, Enum>;
  // for keeping track of the owner table group of a table
  groupOfTable: { [tableid: string]: ElementDeclarationNode };
  tableGroups: Map<ElementDeclarationNode, TableGroup>;
  tablePartials: Map<ElementDeclarationNode, TablePartial>;
  aliases: Alias[];
  project: Map<ElementDeclarationNode, Project>;
}

export interface Database {
  schemas: [];
  tables: Table[];
  notes: Note[];
  refs: Ref[];
  enums: Enum[];
  tableGroups: TableGroup[];
  aliases: Alias[];
  project: Project;
  tablePartials: TablePartial[];
}

export interface Table {
  name: string;
  schemaName: null | string;
  alias: string | null;
  fields: Column[];
  checks: Check[];
  partials: TablePartialInjection[];
  token: TokenPosition;
  indexes: Index[];
  headerColor?: string;
  note?: {
    value: string;
    token: TokenPosition;
  };
}

export interface Note {
  name: string;
  content: string;
  token: TokenPosition;
  headerColor?: string;
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
  checks: Check[];
  pk?: boolean;
  dbdefault?: {
    type: 'number' | 'string' | 'boolean' | 'expression';
    value: number | string;
  };
  increment?: boolean;
  unique?: boolean;
  not_null?: boolean;
  note?: {
    value: string;
    token: TokenPosition;
  };
}

export interface Index {
  columns: {
    value: string;
    type: string;
    token: TokenPosition;
  }[];
  token: TokenPosition;
  unique?: boolean;
  pk?: boolean;
  name?: string;
  note?: {
    value: string;
    token: TokenPosition;
  };
  type?: string;
}

export interface Check {
  token: TokenPosition;
  expression: string;
  name?: string;
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
  color?: string;
  onDelete?: string;
  onUpdate?: string;
  token: TokenPosition;
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
  note?: {
    value: string;
    token: TokenPosition;
  };
}

export interface TableGroup {
  name: string | null;
  schemaName: string | null;
  tables: TableGroupField[];
  token: TokenPosition;
  color?: string;
  note?: {
    value: string;
    token: TokenPosition;
  };
}

export interface TableGroupField {
  name: string;
  schemaName: string | null;
}

export interface Alias {
  name: string;
  kind: 'table';
  value: {
    tableName: string;
    schemaName: string | null;
  };
}

export interface TablePartial {
  name: string;
  fields: Column[];
  token: TokenPosition;
  indexes: Index[];
  headerColor?: string;
  checks: Check[];
  note?: {
    value: string;
    token: TokenPosition;
  };
}

export interface TablePartialInjection {
  name: string;
  order: number;
  token: TokenPosition;
}

export type Project =
  | Record<string, never>
  | {
    name: string | null;
    tables: Table[];
    refs: Ref[];
    enums: Enum[];
    tableGroups: TableGroup[];
    tablePartials: TablePartial[];
    note?: {
      value: string;
      token: TokenPosition;
    };
    token: TokenPosition;
    [
    index: string & Omit<any, 'name' | 'tables' | 'refs' | 'enums' | 'tableGroups' | 'note' | 'tablePartials'>
    ]: string;
  };
