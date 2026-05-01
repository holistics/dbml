import type {
  SyntaxNode,
} from './nodes';
import type {
  NodeSymbol,
} from './symbol';

export enum MetadataKind {
  Ref = 'ref',
  InlineRef = 'inline-ref',
  Check = 'check',
  Index = 'index',
  Record = 'record',
}

export interface RefMetadata {
  kind: MetadataKind.Ref;
  leftTable: NodeSymbol;
  rightTable: NodeSymbol;
  relation: '>' | '<' | '-' | '<>';
  onDelete?: string;
  onUpdate?: string;
  color?: string;
  name?: string;
  declaration: SyntaxNode;
}

export interface InlineRefMetadata {
  kind: MetadataKind.InlineRef;
  target: NodeSymbol;
  relation: '>' | '<' | '-' | '<>';
  fieldNames: string[];
  declaration: SyntaxNode;
}

export interface CheckMetadata {
  kind: MetadataKind.Check;
  target: NodeSymbol;
  expression: string;
  name?: string;
  declaration: SyntaxNode;
}

export interface IndexMetadata {
  kind: MetadataKind.Index;
  target: NodeSymbol;
  columns: { value: string;
    type: string; }[];
  unique?: boolean;
  pk?: boolean;
  name?: string;
  type?: string;
  declaration: SyntaxNode;
}

export interface RecordMetadata {
  kind: MetadataKind.Record;
  target: NodeSymbol;
  columns: string[];
  values: any[][];
  declaration: SyntaxNode;
}

export type SymbolMetadata =
  | RefMetadata
  | InlineRefMetadata
  | CheckMetadata
  | IndexMetadata
  | RecordMetadata;

export function metadataTargets (metadata: SymbolMetadata): NodeSymbol[] {
  if (metadata.kind === MetadataKind.Ref) {
    return [metadata.leftTable, metadata.rightTable];
  }
  return [metadata.target];
}
