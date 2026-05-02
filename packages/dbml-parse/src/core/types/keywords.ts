import {
  SymbolKind,
} from './symbol';

// Allowable import kinds for use declaration
export const ImportKind = {
  Table: SymbolKind.Table,
  Enum: SymbolKind.Enum,
  TableGroup: SymbolKind.TableGroup,
  TablePartial: SymbolKind.TablePartial,
  Note: SymbolKind.Note,
  Schema: SymbolKind.Schema,
};
export type ImportKind = (typeof ImportKind)[keyof typeof ImportKind];

export enum ElementKind {
  Table = 'table',
  Enum = 'enum',
  Ref = 'ref',
  Note = 'note',
  Project = 'project',
  Indexes = 'indexes',
  TableGroup = 'tablegroup',
  TablePartial = 'tablepartial',
  Checks = 'checks',
  Records = 'records',
  DiagramView = 'diagramview',
  DiagramViewTables = 'tables',
  DiagramViewNotes = 'notes',
  DiagramViewTableGroups = 'tablegroups',
  DiagramViewSchemas = 'schemas',
}

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
