import { SymbolKind } from './symbols';

// Allowable import kinds for use declaration
export enum ImportKind {
  Table = 'table',
  Enum = 'enum',
  TableGroup = 'tablegroup',
  TablePartial = 'tablepartial',
  Note = 'note',
  Schema = 'schema',
}

export const IMPORT_KINDS_TO_SYMBOL_KINDS = {
  [ImportKind.Table]: SymbolKind.Table,
  [ImportKind.Enum]: SymbolKind.Enum,
  [ImportKind.TableGroup]: SymbolKind.TableGroup,
  [ImportKind.TablePartial]: SymbolKind.TablePartial,
  [ImportKind.Note]: SymbolKind.Note,
  [ImportKind.Schema]: SymbolKind.Schema,
};

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
