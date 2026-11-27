import { isNil } from 'lodash-es';

export function getOriginalText (ctx) {
  const a = ctx.start.start;
  const b = ctx.stop.stop;

  if (isNil(a) || isNil(b)) return undefined;

  const input = ctx.start.getInputStream();
  return input.getText(a, b);
}

export function getOriginalTextWithoutComment (ctx, isCommentToken) {
  const tokens = ctx.parser.getTokenStream();
  let text = '';
  for (let i = ctx.start.tokenIndex; i <= ctx.stop.tokenIndex; i += 1) {
    const token = tokens.get(i);
    // A comment separates the tokens around it, so it becomes one space.
    const piece = isCommentToken(token) ? ' ' : token.text;
    text += /\s$/.test(text) ? piece.trimStart() : piece;
  }
  return text;
}
