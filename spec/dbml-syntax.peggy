// DBML formal specification, Layer 1: generic syntax.
//
// This grammar restates the lexer and parser in packages/dbml-parse
// (src/core/lexer/lexer.ts, src/core/parser/parser.ts). It accepts exactly
// the inputs the reference parser accepts without reporting an error, and it
// produces the same tree of SyntaxNodeKind values (src/core/types/nodes.ts).
// Element keywords such as Table or Ref are ordinary identifiers here.
//
// Conventions
// - Rules never consume trailing trivia. Trivia is consumed at the start of
//   the construct that needs it, or inspected with lookahead.
// - Node shape: { kind, children }, children in source order, tokens as
//   { token, value }. This mirrors getMemberChain() in src/core/parser/utils.ts.
// - Comments of the form "parser.ts: foo()" name the reference method a rule
//   corresponds to.
//
// Grammar is written for peggy >= 5 (unicode character classes need the u flag).

{{
  const PREFIX_OPS = new Set([
    '+', '-', '<', '>', '<>', '-?', '?-', '?-?', '?>', '>?', '?<', '<?',
    '?>?', '?<?', '?<>', '<>?', '?<>?', '->', '<-', '!', '~',
  ]);
  const ADDITIVE_OPS = new Set(['+', '-', '-?', '?-', '?-?']);
  const COMPARISON_OPS = new Set([
    '<', '<=', '>', '>=', '<>', '?>', '>?', '?<', '<?', '?>?', '?<?', '?<>',
    '<>?', '?<>?', '->', '<-',
  ]);
  const MULTIPLICATIVE_OPS = new Set(['/', '%']);
  const EQUALITY_OPS = new Set(['==', '!=']);

  function tok (kind, value) {
    return { token: kind, value };
  }

  function node (kind, ...children) {
    return {
      kind,
      children: children.flat(Infinity).filter((c) => c !== null && c !== undefined),
    };
  }

  const empty = () => node('<dummy>');

  // Trivia helpers. A gap is an array of trivia units: ' ', '\t', '\r', '\n',
  // or the full text of a comment. A multi-line comment is a single unit, so a
  // newline inside a comment is not a line break for the parser.

  // lexer/utils.ts: hasTrailingNewLines()
  function hasNewline (gap) {
    return gap.includes('\n');
  }

  // lexer/utils.ts: hasTrailingSpaces(), restricted to the trivia before the
  // first line break (that is what the lexer attaches as trailing trivia).
  function hasTrailingSpaces (gap) {
    for (const unit of gap) {
      if (unit === '\n') return false;
      if (unit === ' ' || unit === '\t') return true;
    }
    return false;
  }

  function isIdentifierPrimary (n) {
    return n && n.kind === '<primary-expression>'
      && n.children[0].kind === '<variable>'
      && n.children[0].children[0].token === '<identifier>';
  }

  function identifierValue (n) {
    return n.children[0].children[0].value;
  }

  function isKeyword (identifierToken, word) {
    return identifierToken.token === '<identifier>'
      && identifierToken.value.toLowerCase() === word;
  }

  function foldInfix (head, tail) {
    return tail.reduce((left, [op, right]) => node('<infix-expression>', left, op, right), head);
  }

  function foldPostfix (head, tail) {
    return tail.reduce((left, step) => {
      switch (step.step) {
        case 'call': return node('<call-expression>', left, step.arg);
        case 'index': return node('<array>', left, step.arg);
        default: return node('<infix-expression>', left, step.op, step.arg);
      }
    }, head);
  }

  function interleave (items, separators) {
    const out = [];
    items.forEach((item, i) => {
      out.push(item);
      if (i < separators.length) out.push(separators[i]);
    });
    return out;
  }

  // parser/utils.ts: convertFuncAppToElem()
  // A function application whose shape is
  //   <identifier> [<name> [as <alias>]] [<list>] <block>
  // is reinterpreted as a nested element declaration.
  function convertFuncAppToElem (callee, args) {
    let type = callee;
    let rest = args;
    if (type.kind === '<call-expression>') {
      rest = [type.children[1], ...rest];
      type = type.children[0];
    }
    if (!isIdentifierPrimary(type) || rest.length === 0) return null;
    const typeToken = type.children[0].children[0];
    rest = [...rest];
    const body = rest.pop();
    if (body.kind !== '<block-expression>') return null;
    const attributeList = rest.length > 0 && rest[rest.length - 1].kind === '<list-expression>'
      ? rest.pop()
      : null;
    if (rest.length === 3) {
      if (!isIdentifierPrimary(rest[1]) || identifierValue(rest[1]).toLowerCase() !== 'as') return null;
      const asToken = rest[1].children[0].children[0];
      return node('<element-declaration>', typeToken, rest[0], asToken, rest[2], attributeList, body);
    }
    if (rest.length === 1) {
      return node('<element-declaration>', typeToken, rest[0], attributeList, body);
    }
    if (rest.length === 0) {
      return node('<element-declaration>', typeToken, attributeList, body);
    }
    return null;
  }
}}

{
  // parser/contextStack.ts: number of unclosed '(' and '['. Inside them a '('
  // that starts a new line still continues a call expression.
  let depth = 0;
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

// parser.ts: program()
Program
  = body:Statement* GapAny EOF
    { return node('<program>', body, tok('<eof>', '')); }

// A statement starting with the identifier `use` or `reuse` is always a use
// declaration; it never falls back to an element declaration.
Statement
  = GapAny &UseKeyword d:UseDeclaration { return d; }
  / GapAny !UseKeyword d:ElementDeclaration { return d; }

// ---------------------------------------------------------------------------
// Use declarations
// ---------------------------------------------------------------------------

// parser.ts: useDeclaration()
//   use * from '<path>'
//   use { <specifier> \n <specifier> ... } from '<path>'
UseDeclaration
  = kw:UseKeyword GapAny specifiers:(WildcardNode / UseSpecifierList)
    GapAny from:FromKeyword GapAny path:StringLiteral
    { return node('<use-declaration>', kw, specifiers, from, path); }

// parser.ts: useSpecifierList(); specifiers are separated by line breaks.
UseSpecifierList
  = open:LBrace first:(GapAny s:UseSpecifier { return s; })?
    rest:(GapNewline s:UseSpecifier { return s; })*
    GapAny close:RBrace
    { return node('<use-specifier-list>', open, first, rest, close); }

// parser.ts: useSpecifier()
//   <kind> <name> [as <alias>]
UseSpecifier
  = kind:IdentifierToken GapAny name:UseName
    alias:(GapAny as:AsKeyword GapAny a:UseName { return [as, a]; })?
    { return node('<use-specifier>', kind, name, alias); }

// The name must start with an identifier or quoted variable; it is then read
// as a full normal expression.
UseName
  = &(IdentifierToken / QuotedVariable) e:NormalExpression { return e; }

// ---------------------------------------------------------------------------
// Element declarations
// ---------------------------------------------------------------------------

// parser.ts: elementDeclaration()
//   <type> [<target-kind>] [<name>] [as <alias>] [<attribute-list>] (: <body> | { <body> })
// <target-kind> is present exactly when <type> is `metadata`.
ElementDeclaration
  = type:IdentifierToken
    targetKind:(
        &{ return isKeyword(type, 'metadata'); } GapAny t:IdentifierToken { return t; }
      / !{ return isKeyword(type, 'metadata'); } { return null; }
    )
    name:(&(GapAny !BodyStart) GapAny n:NormalExpression { return n; })?
    alias:(GapAny as:AsKeyword GapAny !BodyStart a:NormalExpression { return [as, a]; })?
    attributeList:(GapAny l:ListExpression { return l; })?
    GapAny body:ElementBody
    { return node('<element-declaration>', type, targetKind, name, alias, attributeList, body); }

BodyStart = ":" / "{" / "["

ElementBody
  = colon:Colon GapAny body:SimpleBody { return [colon, body]; }
  / BlockExpression

// The simple body is a function application that must not itself resolve to
// an element declaration (parser.ts: UNEXPECTED_ELEMENT_DECLARATION).
SimpleBody
  = e:Expression &{ return e.kind !== '<element-declaration>'; } { return e; }

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

// parser.ts: blockExpression()
BlockExpression
  = open:LBrace body:BodyItem* GapAny close:RBrace
    { return node('<block-expression>', open, body, close); }

// parser.ts: canBeField() decides between fieldDeclaration() and expression().
BodyItem
  = GapAny &FieldStart d:FieldDeclaration { return d; }
  / GapAny !FieldStart e:Expression { return e; }

FieldStart = IdentifierToken GapAny ":"

// parser.ts: fieldDeclaration()
//   <type>: <simple-body>
FieldDeclaration
  = type:IdentifierToken GapAny colon:Colon GapAny body:SimpleBody
    { return node('<element-declaration>', type, colon, body); }

// ---------------------------------------------------------------------------
// Function application
// ---------------------------------------------------------------------------

// parser.ts: expression()
// A callee followed by arguments on the same line, each preceded by at least
// one space or tab. The application ends at a line break, end of input, or
// before } ] ) , :  -- anything else there is an error (MISSING_SPACES).
Expression
  = callee:CommaExpression
    args:(gap:GapInline &{ return hasTrailingSpaces(gap); } !"," a:CommaExpression { return a; })*
    &FunctionApplicationStop
    { return convertFuncAppToElem(callee, args) ?? node('<function-application>', callee, args); }

// parser.ts: shouldStopFunctionApplication()
FunctionApplicationStop = GapInline ("\n" / EOF / [}\]):,])

// parser.ts: commaExpression()
// CSV-like list without delimiters. Empty slots produce <dummy> nodes.
CommaExpression
  = first:NormalExpression tail:CommaTail?
    { return tail ? node('<comma-expression>', first, tail) : first; }
  / &"," tail:CommaTail
    { return node('<comma-expression>', empty(), tail); }

CommaTail
  = GapAny comma:Comma rest:CommaRest { return [comma, rest]; }

// After a comma: a line break, end of input, bracket or colon ends the list
// with an empty slot; another comma is an empty slot; otherwise a normal
// expression, which continues only if a comma follows on the same line.
// parser.ts: shouldStopCommaExpression()
CommaRest
  = &CommaStop { return [empty()]; }
  / GapInline comma:Comma rest:CommaRest { return [empty(), comma, rest]; }
  / GapInline e:NormalExpression more:(GapInline comma:Comma rest:CommaRest { return [comma, rest]; })?
    { return [e, more]; }

CommaStop = GapInline ("\n" / EOF / [{}\[\]():])

// ---------------------------------------------------------------------------
// Normal expressions (parser.ts: expression_bp(), Pratt precedence climbing)
// ---------------------------------------------------------------------------
// Binding powers from parser.ts, tightest first:
//   .                     16   right operand is a bare operand
//   prefix operators      15
//   call ( ... )          14
//   / %                   11
//   + - -? ?- ?-?          9
//   relationship ops       7   < <= > >= <> and the ? variants, -> <-
//   == !=                  4
//   =                      2
// All infix operators are left-associative. Trivia, including line breaks,
// may surround infix operators.

NormalExpression = AssignmentExpression

AssignmentExpression
  = head:EqualityExpression tail:(GapAny op:AssignOp GapAny rhs:EqualityExpression { return [op, rhs]; })*
    { return foldInfix(head, tail); }

EqualityExpression
  = head:ComparisonExpression tail:(GapAny op:EqualityOp GapAny rhs:ComparisonExpression { return [op, rhs]; })*
    { return foldInfix(head, tail); }

ComparisonExpression
  = head:AdditiveExpression tail:(GapAny op:ComparisonOp GapAny rhs:AdditiveExpression { return [op, rhs]; })*
    { return foldInfix(head, tail); }

AdditiveExpression
  = head:MultiplicativeExpression tail:(GapAny op:AdditiveOp GapAny rhs:MultiplicativeExpression { return [op, rhs]; })*
    { return foldInfix(head, tail); }

MultiplicativeExpression
  = head:PostfixExpression tail:(GapAny op:MultiplicativeOp GapAny rhs:PostfixExpression { return [op, rhs]; })*
    { return foldInfix(head, tail); }

// Calls, indexing and member access applied to a unary expression.
PostfixExpression
  = head:UnaryExpression tail:(CallStep / IndexStep / MemberStep)*
    { return foldPostfix(head, tail); }

// parser.ts: leftExpression_bp()
// A prefix operator binds tighter than a call: -2() is (-2)().
UnaryExpression
  = op:PrefixOp GapAny e:UnaryExpression { return node('<prefix-expression>', op, e); }
  / MemberChain

// Member access and indexing on a bare operand. The right side of `.` is a
// bare operand (parser.ts: extractOperand()), never a prefix expression.
MemberChain
  = head:Operand tail:(IndexStep / MemberStep)*
    { return foldPostfix(head, tail); }

MemberStep
  = GapAny op:MemberOp GapAny rhs:Operand { return { step: 'member', op, arg: rhs }; }

// A '(' continues a call unless it starts a new line; inside an unclosed '('
// or '[' the line-break rule is suspended.
CallStep
  = gap:GapAny &"(" &{ return depth > 0 || !hasNewline(gap); } arg:TupleExpression
    { return { step: 'call', arg }; }

// A '[' is array indexing only when no space or tab separates it from the
// operand on the same line; otherwise it starts a new argument.
IndexStep
  = gap:GapAny &"[" &{ return !hasTrailingSpaces(gap); } arg:ListExpression
    { return { step: 'index', arg }; }

// parser.ts: extractOperand()
Operand
  = WildcardNode
  / PrimaryExpression
  / FunctionExpression
  / ListExpression
  / BlockExpression
  / TupleExpression

// parser.ts: primaryExpression()
PrimaryExpression
  = t:(StringLiteral / NumericLiteral / ColorLiteral)
    { return node('<primary-expression>', node('<literal>', t)); }
  / t:(QuotedVariable / IdentifierToken)
    { return node('<primary-expression>', node('<variable>', t)); }

FunctionExpression
  = t:FunctionExpressionToken { return node('<function-expression>', t); }

WildcardNode
  = t:Wildcard { return node('<wildcard>', t); }

// parser.ts: tupleExpression(); one element without a comma is a group.
TupleExpression
  = open:TupleOpen GapAny elements:TupleElements? GapAny close:TupleClose
    {
      if (elements && elements.items.length === 1) {
        return node('<group-expression>', open, elements.items[0], close);
      }
      return node('<tuple-expression>', open, elements ? interleave(elements.items, elements.commas) : [], close);
    }

TupleElements
  = head:NormalExpression tail:(GapAny c:Comma GapAny e:NormalExpression { return [c, e]; })*
    { return { items: [head, ...tail.map((t) => t[1])], commas: tail.map((t) => t[0]) }; }

// ---------------------------------------------------------------------------
// Attribute lists
// ---------------------------------------------------------------------------

// parser.ts: listExpression()
//   [ <attribute>, <attribute>, ... ]
ListExpression
  = open:ListOpen GapAny attributes:ListAttributes? GapAny close:ListClose
    { return node('<list-expression>', open, attributes ? interleave(attributes.items, attributes.commas) : [], close); }

ListAttributes
  = head:Attribute tail:(GapAny c:Comma GapAny a:Attribute { return [c, a]; })*
    { return { items: [head, ...tail.map((t) => t[1])], commas: tail.map((t) => t[0]) }; }

// parser.ts: attribute()
//   <name> [: <value>]
Attribute
  = name:AttributeName value:(GapAny c:Colon GapAny v:AttributeValue { return [c, v]; })?
    { return node('<attribute>', name, value); }

// parser.ts: attributeName()
// A stream of identifiers (primary key), or a single literal or quoted variable.
AttributeName
  = IdentifierStream
  / t:(StringLiteral / NumericLiteral / ColorLiteral)
    { return node('<primary-expression>', node('<literal>', t)); }
  / t:QuotedVariable
    { return node('<primary-expression>', node('<variable>', t)); }

IdentifierStream
  = head:IdentifierToken tail:(GapAny t:IdentifierToken { return t; })*
    { return node('<identifier-stream>', head, tail); }

// parser.ts: attributeValue()
// Two leading identifiers make the value an identifier stream (no action);
// anything else is a normal expression.
AttributeValue
  = &(IdentifierToken GapAny IdentifierToken) s:IdentifierStream { return s; }
  / NormalExpression

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

// lexer.ts: operator(). Scanned greedily; the set is prefix-closed so longest
// match reproduces the lexer.
OpToken
  = $("?<>?" / "?<>" / "?<?" / "?<" / "?>?" / "?>" / "?-?" / "?-" / "?"
    / "<>?" / "<>" / "<=" / "<?" / "<-" / "<"
    / ">=" / ">?" / ">"
    / "->" / "-?" / "-"
    / "==" / "=" / "!=" / "!"
    / "+" / "/" ![/*] / "%" / "." / "&" / "|" / "~")

PrefixOp = op:OpToken &{ return PREFIX_OPS.has(op); } { return tok('<op>', op); }
MemberOp = op:OpToken &{ return op === '.'; } { return tok('<op>', op); }
MultiplicativeOp = op:OpToken &{ return MULTIPLICATIVE_OPS.has(op); } { return tok('<op>', op); }
AdditiveOp = op:OpToken &{ return ADDITIVE_OPS.has(op); } { return tok('<op>', op); }
ComparisonOp = op:OpToken &{ return COMPARISON_OPS.has(op); } { return tok('<op>', op); }
EqualityOp = op:OpToken &{ return EQUALITY_OPS.has(op); } { return tok('<op>', op); }
AssignOp = op:OpToken &{ return op === '='; } { return tok('<op>', op); }

// ---------------------------------------------------------------------------
// Keywords (case-insensitive identifiers)
// ---------------------------------------------------------------------------

UseKeyword = t:IdentifierToken &{ return isKeyword(t, 'use') || isKeyword(t, 'reuse'); } { return t; }
FromKeyword = t:IdentifierToken &{ return isKeyword(t, 'from'); } { return t; }
AsKeyword = t:IdentifierToken &{ return isKeyword(t, 'as'); } { return t; }

// ---------------------------------------------------------------------------
// Punctuation
// ---------------------------------------------------------------------------

// text() is used here because peggy balances braces inside action code
// without understanding JavaScript string literals.
LBrace = "{" { return tok('<lbrace>', text()); }
RBrace = "}" { return tok('<rbrace>', text()); }
Comma = "," { return tok('<comma>', ','); }
Colon = ":" { return tok('<colon>', ':'); }
Wildcard = "*" { return tok('<wildcard>', '*'); }

TupleOpen = "(" { depth += 1; return tok('<lparen>', '('); }
TupleClose = ")" { depth -= 1; return tok('<rparen>', ')'); }
ListOpen = "[" { depth += 1; return tok('<lbracket>', '['); }
ListClose = "]" { depth -= 1; return tok('<rbracket>', ']'); }

// ---------------------------------------------------------------------------
// Tokens (lexer.ts)
// ---------------------------------------------------------------------------

// lexer.ts: identifier(), numericLiteralOrIdentifier()
IdentifierToken
  = t:$(IdentifierStart AlnumChar*) { return tok('<identifier>', t); }
  / DigitIdentifier

IdentifierStart = [\p{L}\p{M}_]u
AlnumChar = [\p{L}\p{M}_0-9]u
Digits = $[0-9]+

// A token starting with a digit that is not a well-formed number is an
// identifier: 12_abc, 3a, 1e5x. It never contains a dot.
DigitIdentifier
  = !NumericLiteral t:$([0-9] !"." AlnumChar*) { return tok('<identifier>', t); }

// lexer.ts: numericLiteralOrIdentifier()
//   123  1.5  5.  1e5  1.5e-3
// A number followed by a letter is not a number (1e5x is an identifier); a
// number with two dots or a dot followed by letters is a lexical error.
NumericLiteral
  = t:$(Digits Exponent) !AlnumChar { return tok('<number>', t); }
  / t:$(Digits "." Digits? Exponent) !AlnumChar { return tok('<number>', t); }
  / t:$(Digits "." Digits?) !(AlnumChar / ".") { return tok('<number>', t); }
  / t:$(Digits) !(AlnumChar / ".") { return tok('<number>', t); }

Exponent = [eE] [+-]? Digits

// lexer.ts: singleLineStringLiteral(), multilineStringLiteral()
StringLiteral
  = t:$("'''" (Escape / !("'''" / "\\") .)* "'''") { return tok('<string>', t); }
  / t:$("'" (Escape / !("'" / "\n" / "\\") .)* "'") { return tok('<string>', t); }

// lexer.ts: quotedVariable()
QuotedVariable
  = t:$('"' (Escape / !('"' / "\n" / "\\") .)* '"') { return tok('<variable>', t); }

// lexer.ts: escapedString(). A backslash always starts an escape. Any escaped
// character is accepted; \uHHHH needs four hexadecimal digits; a backslash
// before a line break continues the line.
Escape
  = "\\u" Hex Hex Hex Hex
  / "\\\r\n"
  / "\\" !"u" .

Hex = [0-9a-fA-F]

// lexer.ts: functionExpression(); raw text, no escapes, may span lines.
FunctionExpressionToken
  = t:$("`" (!"`" .)* "`") { return tok('<function-expression>', t); }

// lexer.ts: colorLiteral(); '#' followed by alphanumerics. Hex validation is a
// Layer 2 rule (utils/validate.ts: isValidHexColor).
ColorLiteral
  = t:$("#" AlnumChar*) { return tok('<color>', t); }

// ---------------------------------------------------------------------------
// Trivia (lexer.ts: gatherTrivia())
// ---------------------------------------------------------------------------
// A carriage return is discarded by the lexer, so it is neither whitespace nor
// a line break. A single-line comment does not include its terminating
// newline. A multi-line comment is one unit even when it spans lines.

GapAny = (InlineTrivia / Newline)*
GapInline = InlineTrivia*
GapNewline = GapInline Newline GapAny

InlineTrivia
  = [ \t\r]
  / Comment

Newline = "\n"

Comment
  = $("//" (!"\n" .)*)
  / $("/*" (!"*/" .)* "*/")

EOF = !.
