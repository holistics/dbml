import { EnumDifference } from '@/typeUtils/enum';

/* You shall add more symbol index kinds and symbol kinds */
export enum SymbolIndexKind {
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
}

// In `toSymbolKind`, we have enforced that `SymbolKind` is a superset of `SymbolIndexKind`
// So you cannot make SymbolKind not a superset of SymbolIndexKind
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
  TablePartialInjectedColumn = 'injected TablePartial column',
}

/* You shall need to update this function if you add a new symbol kind */
export function toSymbolIndexKind (symbolKind: SymbolKind): SymbolIndexKind {
  // Don't change this part
  function _isValidSymbolIndexKind (symbolKind: SymbolKind): symbolKind is EnumDifference<SymbolKind, SymbolIndexKind> {
    return isValidSymbolIndexKind(symbolKind);
  }

  if (_isValidSymbolIndexKind(symbolKind)) return symbolKind as string as SymbolIndexKind;

  // Update this switch case to handle the cases where a symbol kind does not exist
  switch (symbolKind) {
    case SymbolKind.TablePartialInjectedColumn:
      return SymbolIndexKind.Column;
    default: {
      const _: never = symbolKind;
      /* istanbul ignore next */
      throw new Error('Unreachable');
    }
  }
}

/* You'll be less likely need to change these functions */
export function isValidSymbolKind (symbolKind: unknown): symbolKind is SymbolKind {
  return Object.values(SymbolKind).includes(symbolKind as any);
}

export function isValidSymbolIndexKind (symbolIndexKind: unknown): symbolIndexKind is SymbolIndexKind {
  return Object.values(SymbolIndexKind).includes(symbolIndexKind as any);
}

export function toSymbolKind (symbolIndexKind: SymbolIndexKind): SymbolKind {
  // Enforce that SymbolKind is always a superset of SymbolIndexKind
  // -- You can try to make SymbolKind a non-superset of SymbolIndexKind & see a Typescript error
  const rawSymbolKind: `${SymbolKind}` = symbolIndexKind as `${SymbolIndexKind}`;
  return rawSymbolKind as string as SymbolKind;
}
