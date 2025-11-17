import fc from 'fast-check';

// FIXME: Respect the subregexes' flags
function orRegex (...subregexes: RegExp[]): RegExp {
  return new RegExp(`(${subregexes.map((r) => r.source).join('|')})`);
}

function chainRegex (...subregexes: RegExp[]): RegExp {
  return new RegExp(subregexes.map((r) => r.source).join(''));
}

function matchFullRegex (regex: RegExp): RegExp {
  return new RegExp(`^(${regex.source})$`, regex.flags);
}

function oneOrManyRegex (regex: RegExp): RegExp {
  return new RegExp(`(${regex.source})+`, regex.flags);
}

function zeroOrManyRegex (regex: RegExp): RegExp {
  return new RegExp(`(${regex.source})*`, regex.flags);
}

const numberRegex = /(\d+\.\d*|\.\d+|\d+)/;
const singleLineStringRegex = /'(\\.|[^'\\\n\r])*'/;
const multiLineStringRegex = /'''(\\.|[^'\\])*'''/;
const quotedIdentifierRegex = /"(\\.|[^"\\\n\r])*"/;
const functionExpressionRegex = /`[^`]*`/;
const identifierRegex = /[a-zA-Z_][a-zA-Z_0-9]*/;
const seppuncRegex = /[:;.,[\]{}(),]/;
const wsRegex = /[ \t\n]/;
const singleLineCommentRegex = /\/\/[^\r\n]*\n/;
const multiLineCommentRegex = /\/\*([^*]|\*[^/])*(\*)?\*\//;
const colorRegex = /#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})/;
const opRegex = /(!=|>=|<=|==|=|>|<|-|\+|\*|\/|%|~)/;

export const tokenStreamArbitrary = fc.stringMatching(chainRegex(/[ ]/, orRegex(
  numberRegex,
  singleLineStringRegex,
  multiLineStringRegex,
  quotedIdentifierRegex,
  functionExpressionRegex,
  identifierRegex,
  seppuncRegex,
  wsRegex,
  singleLineCommentRegex,
  multiLineCommentRegex,
  colorRegex,
  opRegex,
)));
