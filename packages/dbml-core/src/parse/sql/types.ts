import type {
  Check, Column, Index, Ref,
} from '@dbml/parse';

/** Internal context for building a table during CREATE TABLE processing. */
export interface TableCtx {
  schema: string | undefined;
  name: string;
  fields: Column[];
  pkColumns: Set<string>;
  refs: Ref[];
  indexes: Index[];
  checks: Check[];
}

/** Qualified name parsed from a dotted identifier. */
export interface QualifiedName {
  schema?: string;
  name: string;
}
