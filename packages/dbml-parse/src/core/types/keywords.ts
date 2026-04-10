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

export function convertImportKindToSymbolKind (importKind: ImportKind): SymbolKind {
  switch (importKind) {
    case ImportKind.Table:
      return SymbolKind.Table;
    case ImportKind.Enum:
      return SymbolKind.Enum;
    case ImportKind.TableGroup:
      return SymbolKind.TableGroup;
    case ImportKind.TablePartial:
      return SymbolKind.TablePartial;
    case ImportKind.Note:
      return SymbolKind.Note;
    case ImportKind.Schema:
      return SymbolKind.Schema;
    default: {
      const _: never = importKind; // exhaustive check
      throw new Error('Unreachable in convertImportKindToSymbolKind');
    }
  }
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
