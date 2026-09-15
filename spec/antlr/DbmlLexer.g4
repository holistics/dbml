// DBML formal specification, Layer 1: generic syntax. ANTLR notation, lexer.
//
// This is the same specification as ../dbml-syntax.peggy expressed as a
// two-stage ANTLR 4 grammar (DbmlLexer.g4 + DbmlParser.g4), so that the two
// notations can be compared on the same conformance corpus. It restates
// packages/dbml-parse/src/core/lexer/lexer.ts.
//
// Trivia (whitespace and comments) goes to the hidden channel; the parser
// inspects it with getHiddenTokensToLeft(), which is the ANTLR equivalent of
// the reference lexer's trailing/leading trivia (lexer.ts: gatherTrivia()).
// The character stream must be opened with code-point decoding so that
// letters outside the Basic Multilingual Plane match \p{L}.

lexer grammar DbmlLexer;

// ---------------------------------------------------------------------------
// Trivia (lexer.ts: scanTokens(), gatherTrivia())
// ---------------------------------------------------------------------------
// A carriage return is discarded outright: it is neither whitespace nor a line
// break. A single-line comment does not include its terminating newline.

NEWLINE: '\n' -> channel(HIDDEN);
SPACES: [ \t]+ -> channel(HIDDEN);
CR: '\r' -> skip;
LINE_COMMENT: '//' ~[\n]* -> channel(HIDDEN);
BLOCK_COMMENT: '/*' .*? '*/' -> channel(HIDDEN);

// lexer.ts: multilineComment() reports UNEXPECTED_EOF. Without this rule the
// lexer would fall back to SLASH WILDCARD and the parser could accept the file.
UNTERMINATED_BLOCK_COMMENT: '/*' (~'*' | '*'+ ~[*/])* '*'* EOF;

// ---------------------------------------------------------------------------
// Keywords (utils/tokens.ts: isUseKeyword() etc.)
// ---------------------------------------------------------------------------
// Case-insensitive, and ordinary identifiers everywhere the parser does not
// look for them: the parser's `identifier` rule includes all of them. They must
// precede IDENTIFIER so that they win the longest-match tie.

USE: [uU] [sS] [eE];
REUSE: [rR] [eE] [uU] [sS] [eE];
FROM: [fF] [rR] [oO] [mM];
AS: [aA] [sS];
METADATA: [mM] [eE] [tT] [aA] [dD] [aA] [tT] [aA];

// ---------------------------------------------------------------------------
// Punctuation
// ---------------------------------------------------------------------------

LPAREN: '(';
RPAREN: ')';
LBRACKET: '[';
RBRACKET: ']';
LBRACE: '{';
RBRACE: '}';
COMMA: ',';
COLON: ':';
// Lexed by the reference but accepted nowhere; any ';' is a syntax error.
SEMICOLON: ';';
WILDCARD: '*';

// ---------------------------------------------------------------------------
// Operators (lexer.ts: operator())
// ---------------------------------------------------------------------------
// The set is prefix-closed, so ANTLR's longest match reproduces the reference
// lexer's greedy scan. One token per operator lets the parser classify them
// without predicates.

Q_LTGT_Q: '?<>?';
Q_LTGT: '?<>';
Q_LT_Q: '?<?';
Q_LT: '?<';
Q_GT_Q: '?>?';
Q_GT: '?>';
Q_MINUS_Q: '?-?';
Q_MINUS: '?-';
QUESTION: '?';
LTGT_Q: '<>?';
LTGT: '<>';
LTE: '<=';
LT_Q: '<?';
ARROW_LEFT: '<-';
LT: '<';
GTE: '>=';
GT_Q: '>?';
GT: '>';
ARROW_RIGHT: '->';
MINUS_Q: '-?';
MINUS: '-';
EQ: '==';
ASSIGN: '=';
NEQ: '!=';
BANG: '!';
PLUS: '+';
SLASH: '/';
PERCENT: '%';
DOT: '.';
AMP: '&';
PIPE: '|';
TILDE: '~';

// ---------------------------------------------------------------------------
// Literals and identifiers
// ---------------------------------------------------------------------------

// lexer.ts: numericLiteralOrIdentifier(). Longest match decides between
// NUMBER, INVALID_NUMBER and IDENTIFIER; on a tie the first rule wins, so the
// order below matters: 1e5 is a NUMBER, 1e5x is an IDENTIFIER, 1.5x is an
// INVALID_NUMBER.
NUMBER
  : DIGITS EXPONENT
  | DIGITS '.' DIGITS? EXPONENT?
  | DIGITS
  ;

// A dot part followed by letters, or a second dot, is a lexical error in the
// reference (UNKNOWN_TOKEN "Invalid number"). The parser has no rule for this
// token, so its presence rejects the file.
INVALID_NUMBER
  : DIGITS '.' DIGITS? IDENT_START ALNUM_DOT*
  | DIGITS '.' DIGITS? '.' ALNUM_DOT*
  ;

// lexer.ts: identifier(). A token that starts with a digit is an identifier
// when it contains a letter or underscore and is not a well-formed number.
IDENTIFIER
  : IDENT_START ALNUM*
  | DIGITS IDENT_START ALNUM*
  ;

// lexer.ts: singleLineStringLiteral(), multilineStringLiteral()
STRING
  : '\'\'\'' (ESCAPE | ~'\\')*? '\'\'\''
  | '\'' (ESCAPE | ~['\\\n])* '\''
  ;

// lexer.ts: quotedVariable()
QUOTED_VARIABLE: '"' (ESCAPE | ~["\\\n])* '"';

// lexer.ts: functionExpression(); raw text, no escapes, may span lines.
FUNCTION_EXPRESSION: '`' ~'`'* '`';

// lexer.ts: colorLiteral(); hex validation is a Layer 2 rule.
COLOR: '#' ALNUM*;

// lexer.ts: escapedString(). A backslash always starts an escape. Any escaped
// character is accepted; \uHHHH needs four hexadecimal digits; a backslash
// before a line break continues the line.
fragment ESCAPE
  : '\\u' HEX HEX HEX HEX
  | '\\\r\n'
  | '\\' ~'u'
  ;

fragment HEX: [0-9a-fA-F];
fragment DIGITS: [0-9]+;
fragment EXPONENT: [eE] [+-]? DIGITS;
fragment IDENT_START: [\p{L}\p{M}_];
fragment ALNUM: [\p{L}\p{M}_0-9];
fragment ALNUM_DOT: [\p{L}\p{M}_0-9.];
