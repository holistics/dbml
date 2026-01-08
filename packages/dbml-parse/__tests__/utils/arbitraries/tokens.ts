import fc from 'fast-check';
import { orRegex, chainRegex, matchFullRegex, oneOrManyRegex, zeroOrManyRegex } from './utils';

// Matches decimal numbers: integers (123), floats (1.23), or trailing dot decimals (5.)
const numberRegex = /(\d+\.\d*|\d+)/;
// Matches single-line strings with single quotes, allows escapes: 'hello' or 'can\'t', avoid unicode escape sequences for simplicity
const singleLineStringRegex = /'(\\[a-tv-zA-TV-Z0-9]|[^'\\\n\r])*'/;
// Matches multi-line strings with triple quotes: '''hello\nworld'''
const multiLineStringRegex = /'''(\\[a-tv-zA-TV-Z0-9]|[^'\\])*'''/;
// Matches quoted identifiers with double quotes for names with spaces: "table name"
const quotedIdentifierRegex = /"(\\[a-tv-zA-TV-Z0-9]|[^"\\\n\r])*"/;
// Matches function expressions wrapped in backticks: `now()` or `CURRENT_TIMESTAMP`
const functionExpressionRegex = /`[^`]*`/;
// Matches unquoted identifiers: must start with letter/underscore, then alphanumeric/underscore
const identifierRegex = /[a-zA-Z_][a-zA-Z_0-9]*/;
// Matches separator punctuation: colons, semicolons, dots, brackets, braces, parens, commas
const seppuncRegex = /[:;.,[\]{}(),]/;
// Matches whitespace: space, tab, or newline (CRLF tested separately via crlfSchemaArbitrary)
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

export const identifierArbitrary = fc.stringMatching(matchFullRegex(identifierRegex));
export const quotedIdentifierArbitrary = fc.stringMatching(matchFullRegex(quotedIdentifierRegex));
export const anyIdentifierArbitrary = fc.oneof(
  identifierArbitrary,
  quotedIdentifierArbitrary,
);
export const singleLineStringArbitrary = fc.stringMatching(matchFullRegex(singleLineStringRegex));
export const multiLineStringArbitrary = fc.stringMatching(matchFullRegex(multiLineStringRegex));
export const anyStringArbitrary = fc.oneof(
  singleLineStringArbitrary,
  multiLineStringArbitrary,
);
export const numberArbitrary = fc.stringMatching(matchFullRegex(numberRegex));
export const functionExpressionArbitrary = fc.stringMatching(matchFullRegex(functionExpressionRegex));
export const colorArbitrary = fc.stringMatching(matchFullRegex(colorRegex));
export const opArbitrary = fc.stringMatching(matchFullRegex(opRegex));
export const seppuncArbitrary = fc.stringMatching(matchFullRegex(seppuncRegex));
export const wsArbitrary = fc.stringMatching(matchFullRegex(wsRegex));
export const singleLineCommentArbitrary = fc.stringMatching(matchFullRegex(singleLineCommentRegex));
export const multiLineCommentArbitrary = fc.stringMatching(matchFullRegex(multiLineCommentRegex));
export const commentArbitrary = fc.oneof(
  singleLineCommentArbitrary,
  multiLineCommentArbitrary,
);
export const identifierStreamArbitrary = fc.stringMatching(matchFullRegex(identifierStreamRegex));

// Single token regex (any valid token)
const singleTokenRegex = orRegex(
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
);

// Arbitrary token sequences - allows adjacent tokens without mandatory whitespace
export const tokenStreamArbitrary = fc.stringMatching(matchFullRegex(zeroOrManyRegex(singleTokenRegex)));

// Token stream with guaranteed whitespace between tokens (for testing trivia attachment)
export const spacedTokenStreamArbitrary = fc.stringMatching(matchFullRegex(zeroOrManyRegex(chainRegex(/[ ]/, singleTokenRegex))));
