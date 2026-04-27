import {
  ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
} from '@/core/types/nodes';
import type {
  Alias,
  DiagramView,
  Enum,
  FilterConfig,
  Note,
  Project,
  RecordValueType,
  Ref,
  Table,
  TableGroup,
  TablePartial,
} from '@/core/types/schemaJson';

export type {
  DiagramView, FilterConfig,
};

export interface InterpreterDatabase {
  schema: [];
  tables: Map<ElementDeclarationNode, Table>;
  notes: Map<ElementDeclarationNode, Note>;
  // for keeping track of circular refs
  refIds: { [refid: string]: SyntaxNode };
  ref: Map<SyntaxNode, Ref>;
  enums: Map<ElementDeclarationNode, Enum>;
  tableOwnerGroup: { [tableid: string]: ElementDeclarationNode };
  tableGroups: Map<ElementDeclarationNode, TableGroup>;
  tablePartials: Map<ElementDeclarationNode, TablePartial>;
  aliases: Alias[];
  project: Map<ElementDeclarationNode, Project>;
  records: Map<Table, { element: ElementDeclarationNode;
    rows: TableRecordRow[]; }>;
  recordsElements: ElementDeclarationNode[];
  cachedMergedTables: Map<Table, Table>; // map Table to Table that has been merged with table partials
  source: string;
  diagramViews: Map<ElementDeclarationNode, DiagramView>;
  diagramViewWildcards: Map<DiagramView, Set<string>>;
  diagramViewExplicitlySet: Map<DiagramView, Set<string>>;
}

export interface TableRecordRow {
  values: Record<string, {
    value: any;
    type: RecordValueType;
    node?: SyntaxNode; // The specific node for this column value
  }>;
  node: FunctionApplicationNode;
  columnNodes: Record<string, SyntaxNode>; // Map of column name to its value node
}

export interface TableRecordsData {
  table: Table;
  rows: TableRecordRow[];
}
