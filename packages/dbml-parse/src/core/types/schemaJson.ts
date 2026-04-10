import { Filepath } from './filepath';
import type { Position } from './position';

export interface TokenPosition {
  start: Position;
  end: Position;
  filepath: Filepath;
}

// A reference to an element imported via `use` or `reuse`.
// `name` + `schemaName` identify the original element in the source file.
// `visibleNames` lists every local name under which the element is reachable in this file.
// The first entry wins (primary name).
// Direct imports and explicit `as` aliases both appear here.
// Aliases have `schemaName: null`; direct imports retain the original `schemaName`.
export interface ElementRef {
  name: string;
  schemaName: string | null;
  visibleNames: { schemaName: string | null; name: string }[];
}

export interface DatabaseExternals {
  tables: ElementRef[];
  enums: ElementRef[];
  tableGroups: ElementRef[];
  tablePartials: ElementRef[];
  notes: ElementRef[];
}

export interface Database {
  schemas: [];
  tables: Table[];
  notes: Note[];
  refs: Ref[];
  enums: Enum[];
  tableGroups: TableGroup[];
  aliases: Alias[];
  project?: Project;
  tablePartials: TablePartial[];
  records: TableRecord[];
  externals: DatabaseExternals;
  token?: TokenPosition;
}

export interface MasterDatabase {
  files: Record<string, Database>;
  items: Database;
}

export interface Table {
  name: string;
  schemaName: string | null;
  alias: string | null;
  fields: Column[]; // The order of fields must match the order of declaration
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
  // Parsed type parameters - stripped when passed to @dbml/core
  numericParams?: { precision: number; scale: number };
  lengthParam?: { length: number };
  // Whether this type references an enum - stripped when passed to @dbml/core
  isEnum?: boolean;
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

export type AliasKind = 'table' | 'enum' | 'tablegroup' | 'tablepartial' | 'note';

export interface Alias {
  name: string;
  kind: AliasKind;
  value: {
    elementName: string;
    /** @deprecated Use elementName instead */
    tableName: string;
    schemaName: string | null;
  };
}

export interface TablePartial {
  name: string;
  fields: Column[];
  token: TokenPosition;
  indexes: Index[];
  checks: Check[];
  headerColor?: string;
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

// Record value type
export type RecordValueType = 'string' | 'bool' | 'integer' | 'real' | 'date' | 'time' | 'datetime' | string;

export interface RecordValue {
  value: any;
  type: RecordValueType;
}

export interface TableRecord {
  schemaName: string | undefined;
  tableName: string;
  columns: string[];
  values: RecordValue[][];
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
    index: string & Omit<any, 'name' | 'tables' | 'refs' | 'enums' | 'tableGroups' | 'note' | 'tablePartials' | 'records'>
    ]: string;
  };

export type SchemaElement =
  | Database
  | Project
  | Table
  | Note
  | Column
  | ColumnType
  | Index
  | Check
  | InlineRef
  | Ref
  | RefEndpoint
  | Enum
  | EnumField
  | TableGroup
  | TableGroupField
  | Alias
  | TablePartial
  | TablePartialInjection
  | TableRecord
  | RecordValue;
