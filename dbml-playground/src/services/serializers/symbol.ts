import type {
  SymbolInfo,
} from '@/stores/parserStore';
import type {
  SerializedSymbol, SerializeOpts,
} from './types';
import {
  getReadableId,
} from './utils';

export function serializeSymbol (symbol: SymbolInfo, {
  simple = false,
}: SerializeOpts = {}): SerializedSymbol {
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
  if (symbol.declPos) {
    out.declaration = {
      id,
      declPos: symbol.declPos,
      declFilepath: symbol.declFilepath,
    };
  }
  return out;
}
