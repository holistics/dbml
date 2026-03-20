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

import { type SyntaxNode, type ProgramNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/validator/symbol/symbols';

export type NodeToSymbolMap = WeakMap<SyntaxNode, NodeSymbol>;
export type NodeToRefereeMap = WeakMap<SyntaxNode, NodeSymbol>;

export type AnalysisResult = {
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
};

export type BinderContext = {
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
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
