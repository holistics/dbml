import {
  describe, expect, test,
} from 'vitest';
import {
  SyntaxTokenKind, isTriviaToken,
} from '@/core/types/tokens';
import {
  lex,
} from '@tests/utils';

function getTokens (source: string) {
  return lex(source).getValue().filter((t) => !isTriviaToken(t) && t.kind !== SyntaxTokenKind.EOF);
}

describe('[example] optional ref operators', () => {
  test.each([
    '-', '-?', '?-', '?-?',
    '>', '>?', '?>', '?>?',
    '<', '<?', '?<', '?<?',
    '<>', '<>?', '?<>', '?<>?',
  ])('should tokenize %s as a single operator', (op) => {
    const tokens = getTokens(op);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(SyntaxTokenKind.OP);
    expect(tokens[0].value).toBe(op);
  });

  test('should tokenize all optional ref operators in sequence', () => {
    const source = '- -? ?- ?-? > >? ?> ?>? < <? ?< ?<? <> <>? ?<> ?<>?';
    const tokens = getTokens(source);

    expect(tokens).toHaveLength(16);
    expect(tokens.map((t) => t.value)).toEqual([
      '-', '-?', '?-', '?-?',
      '>', '>?', '?>', '?>?',
      '<', '<?', '?<', '?<?',
      '<>', '<>?', '?<>', '?<>?',
    ]);
  });

  test('should not produce errors for optional ref operators', () => {
    const source = '-? ?- ?-? >? ?> ?>? <? ?< ?<? <>? ?<> ?<>?';
    const result = lex(source);

    expect(result.getErrors()).toHaveLength(0);
  });
});
