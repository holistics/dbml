export enum SymbolKind {
  Schema = 'Schema',

  Table = 'Table',
  Column = 'Column',

  TableGroup = 'TableGroup',
  TableGroupField = 'TableGroup field',

  Enum = 'Enum',
  EnumField = 'Enum field',

  StickyNote = 'Note',

  TablePartial = 'TablePartial',
  PartialInjection = 'PartialInjection',

  DiagramView = 'DiagramView',
  DiagramViewTopLevelWildcard = 'DiagramView top-level wildcard',
  DiagramViewTable = 'DiagramView table',
  DiagramViewTableGroup = 'DiagramView tablegroup',
  DiagramViewNote = 'DiagramView note',
  DiagramViewSchema = 'DiagramView schema',

  Metadata = 'Metadata',

  Program = 'Program',
}

// Allowable import kinds for use declaration
export const ImportKind = {
  Table: SymbolKind.Table,
  Enum: SymbolKind.Enum,
  TableGroup: SymbolKind.TableGroup,
  TablePartial: SymbolKind.TablePartial,
  Note: SymbolKind.StickyNote,
  Schema: SymbolKind.Schema,
};
export type ImportKind = (typeof ImportKind)[keyof typeof ImportKind];

export enum MetadataKind {
  Ref = 'ref',
  Dep = 'dep',
  PartialRef = 'partial ref',
  TableChecks = 'table checks',
  Indexes = 'indexes',
  Records = 'records',
  Project = 'project',
  MetadataElement = 'metadata element',
}

/** Allowed target element types for a Metadata element header */
export enum MetadataTargetKind {
  Table = SymbolKind.Table,
  Column = SymbolKind.Column,
  TableGroup = SymbolKind.TableGroup,
  Note = SymbolKind.StickyNote,
  // The header keyword `Metadata Ref <name>`, a Ref is not a symbol so there is no SymbolKind for it
  Ref = MetadataKind.Ref,
}

// Get the human-readable target kind keyword (e.g. "Table", "Column")
export function getMetadataTargetKindLabel (targetKind: MetadataTargetKind): string {
  switch (targetKind) {
    case MetadataTargetKind.Table:
      return 'Table';
    case MetadataTargetKind.Column:
      return 'Column';
    case MetadataTargetKind.TableGroup:
      return 'TableGroup';
    case MetadataTargetKind.Note:
      return 'Note';
    case MetadataTargetKind.Ref:
      return 'Ref';
    default: {
      const _: never = targetKind;
      return targetKind;
    }
  }
}
