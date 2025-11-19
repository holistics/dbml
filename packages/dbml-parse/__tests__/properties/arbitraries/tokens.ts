import fc from 'fast-check';
import { orRegex, chainRegex, matchFullRegex, oneOrManyRegex, zeroOrManyRegex } from './utils';

// Matches decimal numbers: integers (123), floats (1.23), or trailing dot decimals (5.)
const numberRegex = /(\d+\.\d*|\d+)/;
// Matches single-line strings with single quotes, allows escapes: 'hello' or 'can\'t'
const singleLineStringRegex = /'(\\.|[^'\\\n\r])*'/;
// Matches multi-line strings with triple quotes: '''hello\nworld'''
const multiLineStringRegex = /'''(\\.|[^'\\])*'''/;
// Matches quoted identifiers with double quotes for names with spaces: "table name"
const quotedIdentifierRegex = /"(\\.|[^"\\\n\r])*"/;
// Matches function expressions wrapped in backticks: `now()` or `CURRENT_TIMESTAMP`
const functionExpressionRegex = /`[^`]*`/;
// Matches unquoted identifiers: must start with letter/underscore, then alphanumeric/underscore
const identifierRegex = /[a-zA-Z_][a-zA-Z_0-9]*/;
// Matches separator punctuation: colons, semicolons, dots, brackets, braces, parens, commas
const seppuncRegex = /[:;.,[\]{}(),]/;
// Matches whitespace: space, tab, or newline
const wsRegex = /[ \t\n]/;
// Matches single-line comments: // comment until end of line
const singleLineCommentRegex = /\/\/[^\r\n]*\n/;
// Matches multi-line comments: /* comment */ (handles nested asterisks)
const multiLineCommentRegex = /\/\*([^*]|\*[^/])*(\*)?\*\//;
// Matches hex color codes: #fff or #ffffff
const colorRegex = /#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})/;
// Matches operators: comparison (!=, >=, etc.), arithmetic (+, -, *, /), and bitwise (~)
const opRegex = /(!=|>=|<=|==|=|>|<|-|\+|\*|\/|%|~)/;
// Identifier stream (space-separated identifiers for multi-word keywords, e.g., "not null", "primary key")
const identifierStreamRegex = chainRegex(
  identifierRegex,
  oneOrManyRegex(chainRegex(/[ ]/, identifierRegex)),
);

export const identifierArbitrary = fc.stringMatching(identifierRegex);
export const quotedIdentifierArbitrary = fc.stringMatching(quotedIdentifierRegex);
export const anyIdentifierArbitrary = fc.oneof(
  identifierArbitrary,
  quotedIdentifierArbitrary,
);
export const singleLineStringArbitrary = fc.stringMatching(singleLineStringRegex);
export const multiLineStringArbitrary = fc.stringMatching(multiLineStringRegex);
export const anyStringArbitrary = fc.oneof(
  singleLineStringArbitrary,
  multiLineStringArbitrary,
);
export const numberArbitrary = fc.stringMatching(numberRegex);
export const functionExpressionArbitrary = fc.stringMatching(functionExpressionRegex);
export const colorArbitrary = fc.stringMatching(colorRegex);
export const opArbitrary = fc.stringMatching(opRegex);
export const seppuncArbitrary = fc.stringMatching(seppuncRegex);
export const wsArbitrary = fc.stringMatching(wsRegex);
export const singleLineCommentArbitrary = fc.stringMatching(singleLineCommentRegex);
export const multiLineCommentArbitrary = fc.stringMatching(multiLineCommentRegex);
export const commentArbitrary = fc.oneof(
  singleLineCommentArbitrary,
  multiLineCommentArbitrary,
);
export const identifierStreamArbitrary = fc.stringMatching(identifierStreamRegex);

// Arbitrary token sequences
export const tokenStreamArbitrary = fc.stringMatching(matchFullRegex(zeroOrManyRegex(chainRegex(/[ ]/, orRegex(
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
)))));
