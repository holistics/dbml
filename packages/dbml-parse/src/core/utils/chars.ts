export function isAlphaOrUnderscore (char: string): boolean {
  // Match any letters, accents (some characters are denormalized so the accent and the main character are two separate characters) and underscore
  // \p{L} is used to match letters
  // \p{M} is used to match accents
  // References:
  //   https://unicode.org/Public/UCD/latest/ucd/PropertyValueAliases.txt
  //   https://www.compart.com/en/unicode/category/Mn
  //   https://www.compart.com/en/unicode/category/Me
  //   https://www.compart.com/en/unicode/category/Mc
  return !!char.match(/(\p{L}|_|\p{M})/gu);
}

export function isDigit (char: string): boolean {
  if (!char) return false;
  const c = char[0];

  return c >= '0' && c <= '9';
}

// Check if a character is a valid hexadecimal character
export function isHexChar (char: string): boolean {
  const [c] = char;

  return isDigit(c) || (isAlphaOrUnderscore(c) && c.toLowerCase() >= 'a' && c.toLowerCase() <= 'f');
}

export function isAlphaNumeric (char: string): boolean {
  return isAlphaOrUnderscore(char) || isDigit(char);
}
