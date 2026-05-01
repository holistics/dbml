import type {
  SymbolInfo,
} from '@/stores/parserStore';
import type {
  SerializedSymbol, SerializeOptions,
} from './types';
import {
  getReadableId,
} from './utils';

export function serializeSymbol (symbol: SymbolInfo, {
  simple = false,
}: SerializeOptions = {}): SerializedSymbol {
  const id = getReadableId(symbol);
  if (simple) return {
    id,
  };

  const out: SerializedSymbol = {
    id,
  };
  if (symbol.members.length > 0) {
    out.members = symbol.members.map((m) => serializeSymbol(m));
  }
  if (symbol.declarationPosition) {
    out.declaration = {
      id,
      declarationPosition: symbol.declarationPosition,
      declarationFilepath: symbol.declarationFilepath,
    };
  }
  return out;
}
