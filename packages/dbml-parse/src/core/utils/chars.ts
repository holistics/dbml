export function isAlphaOrUnderscore (char: string): boolean {
  return !!char.match(/(\p{L}|_|\p{M})/gu);
}

export function isDigit (char: string): boolean {
  if (!char) return false;
  const c = char[0];

  return c >= '0' && c <= '9';
}

export function isHexChar (char: string): boolean {
  const [c] = char;

  return isDigit(c) || (isAlphaOrUnderscore(c) && c.toLowerCase() >= 'a' && c.toLowerCase() <= 'f');
}

export function isAlphaNumeric (char: string): boolean {
  return isAlphaOrUnderscore(char) || isDigit(char);
}

export function alternateLists<T, S> (firstList: T[], secondList: S[]): (T | S)[] {
  const res: (T | S)[] = [];
  const minLength = Math.min(firstList.length, secondList.length);
  for (let i = 0; i < minLength; i += 1) {
    res.push(firstList[i], secondList[i]);
  }
  res.push(...firstList.slice(minLength), ...secondList.slice(minLength));

  return res;
}
