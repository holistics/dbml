import { SyntaxNode, SyntaxToken } from '@dbml/parse';
import { serializeNode } from './node';
import { serializeSymbol } from './symbol';
import { serializeToken } from './token';
import type { Serializable, SerializeOptions, SerializedValue } from './types';
import { isSymbolInfo } from './utils';

export * from './types';
export { serializeNode } from './node';
export { serializeSymbol } from './symbol';
export { serializeToken } from './token';

export function serialize (value: Serializable, opts?: SerializeOptions): SerializedValue {
  if (Array.isArray(value)) return value.map((v) => serialize(v as Serializable, opts));
  if (value instanceof SyntaxToken) return serializeToken(value, opts);
  if (value instanceof SyntaxNode) return serializeNode(value, opts);
  if (value === null || value === undefined) return value;
  if (isSymbolInfo(value)) return serializeSymbol(value, opts);
  if (typeof value === 'object') {
    const out: Record<string, SerializedValue> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v as Serializable, opts);
    return out;
  }
  if (typeof value === 'bigint' || typeof value === 'symbol') return value.toString();
  return value;
}
