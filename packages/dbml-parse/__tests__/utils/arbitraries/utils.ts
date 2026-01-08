import fc from 'fast-check';

// FIXME: Respect the subregexes' flags
export function orRegex (...subregexes: RegExp[]): RegExp {
  return new RegExp(`(${subregexes.map((r) => r.source).join('|')})`);
}

export function chainRegex (...subregexes: RegExp[]): RegExp {
  return new RegExp(subregexes.map((r) => r.source).join(''));
}

export function matchFullRegex (regex: RegExp): RegExp {
  return new RegExp(`^(${regex.source})$`, regex.flags);
}

export function oneOrManyRegex (regex: RegExp): RegExp {
  return new RegExp(`(${regex.source})+`, regex.flags);
}

export function zeroOrManyRegex (regex: RegExp): RegExp {
  return new RegExp(`(${regex.source})*`, regex.flags);
}

/**
 * Helper to generate case variations of a string (lowercase, uppercase, original)
 * Examples:
 *   caseVariant('table') => 'Table' | 'tAble' | 'taBle'
 */
export const caseVariant = (str: string) => fc.oneof(
  fc.nat({ max: str.length - 1 }).map((pos) => str.slice(0, pos) + str[pos].toUpperCase() + str.slice(pos + 1)),
  fc.constant(str),
  fc.constant(str.toUpperCase()),
  fc.constant(str.toLowerCase()),
);

/**
 * Helper to generate case variations of one of multiple strings
 * Picks one string from the arguments and varies its case
 * Examples:
 *   caseVariantOneOf('primary key', 'pk') => 'primary key' | 'PRIMARY KEY' | 'pk' | 'PK' | etc.
 */
export const caseVariantOneOf = (...strings: string[]) =>
  fc.oneof(...strings.map((str) => caseVariant(str)));

/**
 * Helper to generate case variations with key:value format for settings
 */
export const settingKeyValue = (key: string, valueArb: fc.Arbitrary<string>) =>
  fc.tuple(caseVariant(key), valueArb).map(([k, v]) => `${k}: ${v}`);

/**
 * Helper to generate random whitespace (spaces, tabs, newlines)
 * CRLF tested separately via crlfSchemaArbitrary
 */
export const randomSpaceArbitrary = fc.array(
  fc.oneof(
    { weight: 10, arbitrary: fc.constant(' ') },
    { weight: 3, arbitrary: fc.constant('\t') },
    { weight: 1, arbitrary: fc.constant('\n') },
  ),
  { minLength: 1, maxLength: 3 },
).map((arr) => arr.join(''));

/**
 * Helper to generate random inline whitespace (spaces and tabs only, NO newlines)
 * Returns 1-3 whitespace characters
 * Use this for single-line constructs (columns, enum values, checks, indexes)
 */
export const randomInlineSpaceArbitrary = fc.array(
  fc.oneof(
    { weight: 10, arbitrary: fc.constant(' ') },
    { weight: 3, arbitrary: fc.constant('\t') },
  ),
  { minLength: 1, maxLength: 3 },
).map((arr) => arr.join(''));

/**
 * Helper to join string/arbitrary tokens with random spacing between them
 * Automatically injects random whitespace between all tokens (including newlines)
 * Use this for top-level declarations (Table, Enum, Ref, etc.)
 *
 * @param tokens - Array of strings or arbitraries to join
 * @returns An arbitrary that produces the joined string with random spacing
 *
 * @example
 * joinWithRandomSpaces(caseVariant('Table'), 'users', '{')
 * // Produces: "Table  users {" or "TABLE\n\tusers\t{" etc.
 */
export const joinWithRandomSpaces = (...tokens: (fc.Arbitrary<string> | string)[]) => {
  // Convert string tokens to constant arbitraries
  const arbitraries = tokens.map((t) => typeof t === 'string' ? fc.constant(t) : t);

  // Interleave with random space arbitraries
  const withSpaces = arbitraries.flatMap((token, i) =>
    i === 0 ? [token] : [randomSpaceArbitrary, token],
  );

  return fc.tuple(...withSpaces).map((parts) => parts.join(''));
};

/**
 * Helper to join string/arbitrary tokens with random inline spacing (NO newlines)
 * Use this for single-line constructs (columns, enum values, checks, indexes)
 *
 * @param tokens - Array of strings or arbitraries to join
 * @returns An arbitrary that produces the joined string with random inline spacing
 *
 * @example
 * joinWithRandomInlineSpaces('id', 'int', '[pk]')
 * // Produces: "id  int [pk]" or "id\tint\t\t[pk]" etc. (no newlines)
 */
export const joinWithRandomInlineSpaces = (...tokens: (fc.Arbitrary<string> | string)[]) => {
  // Convert string tokens to constant arbitraries
  const arbitraries = tokens.map((t) => typeof t === 'string' ? fc.constant(t) : t);

  // Interleave with random inline space arbitraries
  const withSpaces = arbitraries.flatMap((token, i) =>
    i === 0 ? [token] : [randomInlineSpaceArbitrary, token],
  );

  return fc.tuple(...withSpaces).map((parts) => parts.join(''));
};
