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

export const numberRegex = /(\d+\.\d*|\.\d+|\d+)/;
export const singleLineStringRegex = /'(\\.|[^'\\\n\r])*'/;
export const multiLineStringRegex = /'''(\\.|[^'\\])*'''/;
export const quotedIdentifierRegex = /"(\\.|[^"\\\n\r])*"/;
export const functionExpressionRegex = /`[^`]*`/;
export const identifierRegex = /[a-zA-Z_][a-zA-Z_0-9]*/;
export const seppuncRegex = /[:;.,[\]{}(),]/;
export const wsRegex = /[ \t\n]/;
export const singleLineCommentRegex = /\/\/[^\r\n]*\n/;
export const multiLineCommentRegex = /\/\*([^*]|\*[^/])*(\*)?\*\//;
export const colorRegex = /#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})/;
export const opRegex = /(!=|>=|<=|==|=|>|<|-|\+|\*|\/|%|~)/;
