import { isNil } from 'lodash';

export function getOriginalText (ctx) {
  const a = ctx.start.start;
  const b = ctx.stop.stop;

  if (isNil(a) || isNil(b)) return undefined;

  const input = ctx.start.getInputStream();
  return input.getText(a, b);
}
