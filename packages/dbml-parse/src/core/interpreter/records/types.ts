import { FunctionApplicationNode } from '@/core/parser/nodes';
import { RefRelation } from '@/constants';

// Foreign key constraint (supports composite keys)
export interface FkConstraint {
  // Source columns in this table
  sourceColumns: string[];
  targetSchema: string | null;
  targetTable: string;
  // Target columns in referenced table
  targetColumns: string[];
  relation: RefRelation;
}

// Column schema for records interpretation
export interface ColumnSchema {
  name: string;
  // SQL type name (e.g., 'int', 'varchar', 'decimal')
  type: string;
  // Whether the column references an enum type
  isEnum: boolean;
  // Single-column constraints
  notNull: boolean;
  // Default value
  dbdefault?: {
    type: 'number' | 'string' | 'boolean' | 'expression';
    value: number | string;
  };
  increment: boolean;
  // Type parameters for numeric types (e.g., decimal(10, 2))
  numericTypeParams: { precision?: number; scale?: number };
  // Type parameters for string types (e.g., varchar(255), char(10))
  stringTypeParams: { length?: number };
  // Type parameters for binary types (e.g., binary(16), varbinary(255))
  binaryTypeParams: { length?: number };
}

// Intermediate structure for interpreting records of a single table.
// Pre-computes column metadata for type checking and constraint validation.
export interface RecordsBatch {
  table: string;
  schema: string | null;
  columns: ColumnSchema[];
  // Constraints (supports composite keys)
  constraints: {
    // Primary key constraints (each array is a set of columns forming a PK)
    pk: string[][];
    // Unique constraints (each array is a set of columns forming a unique constraint)
    unique: string[][];
    // Foreign key constraints
    fk: FkConstraint[];
  };
  // Raw row nodes from the records body
  rows: FunctionApplicationNode[];
}
