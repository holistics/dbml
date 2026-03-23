import { type NodeSymbolIndex } from '@/core/validator/symbol/symbolIndex';

// Helper to construct NodeSymbolIndex from raw strings in tests
export function idx (raw: string): NodeSymbolIndex {
  return raw as NodeSymbolIndex;
}
