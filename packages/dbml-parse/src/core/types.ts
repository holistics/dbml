import { type SyntaxNode, type ProgramNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/validator/symbol/symbols';
import type { Filepath } from '@/compiler/projectLayout/filepath';

export interface Position {
  offset: number;
  line: number;
  column: number;
}
export enum ElementKind {
  Table = 'table',
  Enum = 'enum',
  Ref = 'ref',
  Note = 'note',
  Project = 'project',
  Indexes = 'indexes',
  TableGroup = 'tablegroup',
  TablePartial = 'tablepartial',
  Check = 'checks',
  Records = 'records',
}

export type NodeToSymbolMap = Map<SyntaxNode, NodeSymbol>;
export type NodeToRefereeMap = WeakMap<SyntaxNode, NodeSymbol>;
export type SymbolToReferencesMap = Map<NodeSymbol, SyntaxNode[]>;

export type AnalysisResult = {
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
  symbolToReferences: SymbolToReferencesMap;
};

export type BinderContext = {
  filepath: Filepath;
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
  symbolToReferences: SymbolToReferencesMap;
};

export enum SettingName {
  Color = 'color',
  HeaderColor = 'headercolor',
  Note = 'note',

  PK = 'pk',
  PrimaryKey = 'primary key',
  Unique = 'unique',
  Ref = 'ref',
  NotNull = 'not null',
  Null = 'null',
  Increment = 'increment',
  Default = 'default',
  Name = 'name',
  Type = 'type',
  Check = 'check',

  Update = 'update',
  Delete = 'delete',
}
