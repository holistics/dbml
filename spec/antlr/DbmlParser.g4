// DBML formal specification, Layer 1: generic syntax. ANTLR notation, parser.
//
// Restates packages/dbml-parse/src/core/parser/parser.ts. Rule comments name
// the reference method they correspond to. The parser is generated for the
// JavaScript target (the runtime @dbml/core already uses); the members block
// is therefore JavaScript and is emitted into the generated constructor.
//
// Three groups of semantic predicates carry what the notation cannot:
// 1. trivia-sensitive rules (index vs new argument, call vs new line, argument
//    spacing, line-separated use specifiers), read from the hidden channel;
// 2. one-token commitments the reference makes with a single lookahead, so
//    that ALL(*) does not find a second parse the reference never tries;
// 3. the bracket-depth context that suspends the call/new-line rule.
// One embedded action rejects a simple body that resolves to an element
// declaration (parser.ts: UNEXPECTED_ELEMENT_DECLARATION).

parser grammar DbmlParser;

options { tokenVocab = DbmlLexer; }

@parser::members {
  // parser/contextStack.ts: number of unclosed '(' and '['. Inside them a '('
  // that starts a new line still continues a call expression.
  this.depth = 0;

  // Hidden-channel tokens between the previous token and the next one: the
  // reference lexer's trailing/leading trivia (lexer.ts: gatherTrivia()).
  this.gapAhead = () => {
    const next = this._input.LT(1);
    return this._input.getHiddenTokensToLeft(next.tokenIndex, antlr4.Token.HIDDEN_CHANNEL) ?? [];
  };
  // lexer/utils.ts: hasTrailingNewLines(), isAtStartOfLine()
  this.newlineBefore = () => this.gapAhead().some((t) => t.type === DbmlParser.NEWLINE);
  // lexer/utils.ts: hasTrailingSpaces(): a space or tab before the first line break
  this.spaceBefore = () => {
    for (const t of this.gapAhead()) {
      if (t.type === DbmlParser.NEWLINE) return false;
      if (t.type === DbmlParser.SPACES) return true;
    }
    return false;
  };

  this.ahead = (k) => this._input.LT(k).type;
  this.isIdentifierToken = (type) => [
    DbmlParser.IDENTIFIER, DbmlParser.USE, DbmlParser.REUSE, DbmlParser.FROM, DbmlParser.AS, DbmlParser.METADATA,
  ].includes(type);

  // parser.ts: elementDeclaration(): a name or alias is read unless ':' '{' or '[' follows
  this.bodyStartAhead = () => [DbmlParser.COLON, DbmlParser.LBRACE, DbmlParser.LBRACKET].includes(this.ahead(1));
  // parser.ts: useSpecifier(): a name must start with an identifier or quoted variable
  this.nameStartAhead = () => this.isIdentifierToken(this.ahead(1)) || this.ahead(1) === DbmlParser.QUOTED_VARIABLE;
  // parser.ts: canBeField()
  this.fieldAhead = () => this.isIdentifierToken(this.ahead(1)) && this.ahead(2) === DbmlParser.COLON;
  // parser.ts: attributeValue(): two leading identifiers make an identifier stream
  this.twoIdentifiersAhead = () => this.isIdentifierToken(this.ahead(1)) && this.isIdentifierToken(this.ahead(2));
  // parser.ts: expression(): arguments sit on the same line, after a space, and never start with a comma
  this.argAhead = () => this.spaceBefore() && !this.newlineBefore() && this.ahead(1) !== DbmlParser.COMMA;
  // parser.ts: shouldStopFunctionApplication()
  this.functionApplicationStops = () => this.ahead(1) === antlr4.Token.EOF || this.newlineBefore()
    || [DbmlParser.RBRACE, DbmlParser.RBRACKET, DbmlParser.RPAREN, DbmlParser.COMMA, DbmlParser.COLON].includes(this.ahead(1));
  // parser.ts: shouldStopCommaExpression()
  this.commaStops = () => this.ahead(1) === antlr4.Token.EOF || this.newlineBefore()
    || [DbmlParser.LBRACE, DbmlParser.RBRACE, DbmlParser.LBRACKET, DbmlParser.RBRACKET, DbmlParser.LPAREN, DbmlParser.RPAREN, DbmlParser.COLON].includes(this.ahead(1));

  // parser/utils.ts: convertFuncAppToElem(), shape test only. A function
  // application of the form <identifier> [<name> [as <alias>]] [<list>] <block>
  // is an element declaration and may not be a simple body.
  this.unwrap = (ctx) => {
    while (ctx && ctx.children && ctx.children.length === 1 && ctx.children[0].children) ctx = ctx.children[0];
    return ctx;
  };
  this.isElementShaped = (exprCtx) => {
    const parts = exprCtx.commaExpression();
    let callee = this.unwrap(parts[0]);
    let args = parts.slice(1);
    if (callee instanceof DbmlParser.PostfixExpressionContext) {
      if (callee.callStep().length !== 1 || callee.chainStep().length !== 0) return false;
      args = [callee.callStep(0).tupleExpression(), ...args];
      callee = this.unwrap(callee.unaryExpression());
    }
    if (!(callee instanceof DbmlParser.IdentifierContext) || args.length === 0) return false;
    const rest = args.slice();
    if (!(this.unwrap(rest.pop()) instanceof DbmlParser.BlockExpressionContext)) return false;
    if (rest.length > 0 && this.unwrap(rest[rest.length - 1]) instanceof DbmlParser.ListExpressionContext) rest.pop();
    if (rest.length === 3) {
      const as = this.unwrap(rest[1]);
      return as instanceof DbmlParser.IdentifierContext && as.getText().toLowerCase() === 'as';
    }
    return rest.length <= 1;
  };
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

// parser.ts: program()
program: statement* EOF;

// A statement starting with `use` or `reuse` is always a use declaration;
// elementDeclaration does not accept those tokens as a type.
statement
  : useDeclaration
  | elementDeclaration
  ;

// ---------------------------------------------------------------------------
// Use declarations
// ---------------------------------------------------------------------------

// parser.ts: useDeclaration()
//   use * from '<path>'
//   use { <specifier> \n <specifier> ... } from '<path>'
useDeclaration: (USE | REUSE) (wildcard | useSpecifierList) FROM STRING;

// parser.ts: useSpecifierList(); specifiers are separated by line breaks.
useSpecifierList: LBRACE useSpecifier? ({this.newlineBefore()}? useSpecifier)* RBRACE;

// parser.ts: useSpecifier()
//   <kind> <name> [as <alias>]
useSpecifier: identifier useName (AS useName)?;

// The name must start with an identifier or quoted variable; it is then read
// as a full normal expression.
useName: {this.nameStartAhead()}? normalExpression;

// ---------------------------------------------------------------------------
// Element declarations
// ---------------------------------------------------------------------------

// parser.ts: elementDeclaration()
//   <type> [<target-kind>] [<name>] [as <alias>] [<attribute-list>] (: <body> | { <body> })
// <target-kind> is present exactly when <type> is `metadata`.
elementDeclaration
  : METADATA identifier elementTail
  | (IDENTIFIER | FROM | AS) elementTail
  ;

// The reference decides on one token whether a name or alias is present; the
// predicates keep ALL(*) from choosing the other reading.
elementTail
  : ({!this.bodyStartAhead()}? normalExpression | {this.bodyStartAhead()}?)
    (AS {!this.bodyStartAhead()}? normalExpression)?
    listExpression?
    elementBody
  ;

elementBody
  : COLON simpleBody
  | blockExpression
  ;

// parser.ts: UNEXPECTED_ELEMENT_DECLARATION / INVALID_ELEMENT_IN_SIMPLE_BODY
simpleBody
  : expression
    { if (this.isElementShaped(localctx.expression())) this.notifyErrorListeners('a simple body must not be an element declaration'); }
  ;

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

// parser.ts: blockExpression()
blockExpression: LBRACE bodyItem* RBRACE;

// parser.ts: canBeField() decides between fieldDeclaration() and expression().
bodyItem
  : {this.fieldAhead()}? fieldDeclaration
  | {!this.fieldAhead()}? expression
  ;

// parser.ts: fieldDeclaration()
//   <type>: <simple-body>
fieldDeclaration: identifier COLON simpleBody;

// ---------------------------------------------------------------------------
// Function application
// ---------------------------------------------------------------------------

// parser.ts: expression()
// A callee followed by arguments on the same line, each preceded by at least
// one space or tab. The application must end at a line break, end of input, or
// before } ] ) , :  (parser.ts: MISSING_SPACES otherwise).
expression
  : commaExpression ({this.argAhead()}? commaExpression)* {this.functionApplicationStops()}?
  ;

// parser.ts: commaExpression()
// CSV-like list without delimiters. Empty slots are recorded by the tree
// converter as <dummy> nodes.
commaExpression
  : normalExpression (COMMA commaRest)?
  | COMMA commaRest
  ;

// After a comma: a line break, end of input, bracket or colon ends the list
// with an empty slot; another comma is an empty slot; otherwise a normal
// expression, which continues only if a comma follows on the same line.
// parser.ts: shouldStopCommaExpression()
commaRest
  : {this.commaStops()}?
  | {!this.commaStops()}? COMMA commaRest
  | {!this.commaStops()}? normalExpression ({!this.newlineBefore()}? COMMA commaRest)?
  ;

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

normalExpression: assignmentExpression;

assignmentExpression: equalityExpression (ASSIGN equalityExpression)*;
equalityExpression: comparisonExpression ((EQ | NEQ) comparisonExpression)*;
comparisonExpression: additiveExpression (comparisonOp additiveExpression)*;
additiveExpression: multiplicativeExpression (additiveOp multiplicativeExpression)*;
multiplicativeExpression: postfixExpression ((SLASH | PERCENT) postfixExpression)*;

// Calls applied to a unary expression; after a call, indexing and member
// access may continue the chain.
postfixExpression: unaryExpression (callStep chainStep*)*;

// parser.ts: leftExpression_bp()
// A prefix operator binds tighter than a call: -2() is (-2)().
unaryExpression
  : prefixOp unaryExpression
  | memberChain
  ;

// Member access and indexing on a bare operand. The right side of `.` is a
// bare operand (parser.ts: extractOperand()), never a prefix expression.
memberChain: operand chainStep*;

chainStep
  : indexStep
  | memberStep
  ;

memberStep: DOT operand;

// A '(' continues a call unless it starts a new line; inside an unclosed '('
// or '[' the line-break rule is suspended.
callStep: {this.depth > 0 || !this.newlineBefore()}? tupleExpression;

// A '[' is array indexing only when no space or tab separates it from the
// operand on the same line; otherwise it starts a new argument.
indexStep: {!this.spaceBefore()}? listExpression;

// parser.ts: extractOperand()
operand
  : wildcard
  | primaryExpression
  | functionExpression
  | listExpression
  | blockExpression
  | tupleExpression
  ;

// parser.ts: primaryExpression()
primaryExpression
  : literal
  | variable
  ;

literal: STRING | NUMBER | COLOR;
variable: identifier | QUOTED_VARIABLE;
functionExpression: FUNCTION_EXPRESSION;
wildcard: WILDCARD;

// parser.ts: tupleExpression(); one element without a comma is a group.
tupleExpression
  : LPAREN {this.depth += 1;} (normalExpression (COMMA normalExpression)*)? RPAREN {this.depth -= 1;}
  ;

// ---------------------------------------------------------------------------
// Attribute lists
// ---------------------------------------------------------------------------

// parser.ts: listExpression()
//   [ <attribute>, <attribute>, ... ]
listExpression
  : LBRACKET {this.depth += 1;} (attribute (COMMA attribute)*)? RBRACKET {this.depth -= 1;}
  ;

// parser.ts: attribute()
//   <name> [: <value>]
attribute: attributeName (COLON attributeValue)?;

// parser.ts: attributeName()
// A stream of identifiers (primary key), or a single literal or quoted variable.
attributeName
  : identifierStream
  | literal
  | QUOTED_VARIABLE
  ;

identifierStream: identifier+;

// parser.ts: attributeValue()
attributeValue
  : {this.twoIdentifiersAhead()}? identifierStream
  | {!this.twoIdentifiersAhead()}? normalExpression
  ;

// ---------------------------------------------------------------------------
// Operators and identifiers
// ---------------------------------------------------------------------------

// parser.ts: prefixBpMap
prefixOp
  : PLUS | MINUS | LT | GT | LTGT | MINUS_Q | Q_MINUS | Q_MINUS_Q | Q_GT | GT_Q | Q_LT | LT_Q
  | Q_GT_Q | Q_LT_Q | Q_LTGT | LTGT_Q | Q_LTGT_Q | ARROW_RIGHT | ARROW_LEFT | BANG | TILDE
  ;

// parser.ts: infixBpMap, Prec.Additive
additiveOp: PLUS | MINUS | MINUS_Q | Q_MINUS | Q_MINUS_Q;

// parser.ts: infixBpMap, Prec.Comparison
comparisonOp
  : LT | LTE | GT | GTE | LTGT | Q_GT | GT_Q | Q_LT | LT_Q | Q_GT_Q | Q_LT_Q | Q_LTGT | LTGT_Q | Q_LTGT_Q
  | ARROW_RIGHT | ARROW_LEFT
  ;

// Keywords are ordinary identifiers wherever the parser is not looking for them.
identifier: IDENTIFIER | USE | REUSE | FROM | AS | METADATA;
