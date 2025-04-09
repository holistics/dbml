export enum ElementKindName {
  Table = 'Table',
  Enum = 'Enum',
  Ref = 'Ref',
  Note = 'Note',
  Project = 'Project',
  Indexes = 'Indexes',
  TableGroup = 'TableGroup',
  TableFragment = 'TableFragment',
}

export enum ElementKind {
  Table = 'table',
  Enum = 'enum',
  Ref = 'ref',
  Note = 'note',
  Project = 'project',
  Indexes = 'indexes',
  TableGroup = 'tablegroup',
  TableFragment = 'tablefragment',
}

export enum SettingName {
  Note = 'note',
  Ref = 'ref',
  PKey = 'primary key',
  PK = 'pk',
  NotNull = 'not null',
  Null = 'null',
  Unique = 'unique',
  Increment = 'increment',
  Default = 'default',

  HeaderColor = 'headercolor',
  Color = 'color',

  Name = 'name',
  Type = 'type',

  Update = 'update',
  Delete = 'delete',
}

export type TopLevelElementKindName =
  ElementKindName.Table
  | ElementKindName.Enum
  | ElementKindName.TableFragment
  | ElementKindName.TableGroup
  | ElementKindName.Project
  | ElementKindName.Ref;
