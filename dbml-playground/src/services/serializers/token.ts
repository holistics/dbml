import type {
  SyntaxToken,
} from '@dbml/parse';
import type {
  SerializedToken, SerializeOpts,
} from './types';
import {
  getReadableId,
} from './utils';

export function serializeToken (token: SyntaxToken, { simple = false }: SerializeOpts = {}): SerializedToken {
  const id = getReadableId(token);
  if (simple) {
    const out: SerializedToken = { id };
    if (token.isInvalid) out.isInvalid = true;
    return out;
  }
  const out: SerializedToken = {
    id,
    value: token.value,
    leadingTrivia: token.leadingTrivia.map((t) => t.value).join(''),
    trailingTrivia: token.trailingTrivia.map((t) => t.value).join(''),
  };
  if (token.isInvalid) out.isInvalid = true;
  return out;
}
