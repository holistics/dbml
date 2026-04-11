import type { SyntaxNode } from '@/core/types/nodes';
import type { Database, DiagramView as DiagramViewSchema, FilterConfig } from '@/core/types/schemaJson';

export interface ElementInterpreter {
  // Placeholder for interpreter pattern
}

export interface InterpreterDatabase {
  [key: string]: any;
}

export interface TableRecordRow {
  [key: string]: any;
}

export type DiagramView = DiagramViewSchema;
