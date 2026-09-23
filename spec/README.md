# DBML formal specification

This directory holds the formal specification of DBML. It is organised in the same three layers as the reference implementation in [`packages/dbml-parse`](../packages/dbml-parse), so that every statement in the spec can be checked mechanically against the code.

| Layer | What it specifies | Spec artefact | Reference implementation |
| --- | --- | --- | --- |
| 1. Generic syntax | Tokens and the element-agnostic syntax tree (`SyntaxNodeKind`) | [`dbml-syntax.peggy`](./dbml-syntax.peggy), with an ANTLR rendering in [`antlr/`](./antlr) | `src/core/lexer/lexer.ts`, `src/core/parser/parser.ts` |
| 2. Element semantics | Per-element rules: name shape, body form, allowed settings and sub-elements | `elements/<element>.schema.json` (future PRs) | `src/core/local_modules/<element>/validate.ts` |
| 3. Interpreted model | The `Database` JSON model produced by `@dbml/core` | `output/database.schema.json` (future PR) | `packages/dbml-core/src/model_structure/*.ts` |

## The authority rule

The reference parser is the authority on what DBML *is* today. The spec is the authority on what DBML *should be*. Whenever the two disagree, the disagreement is recorded in [`DISAGREEMENTS.md`](./DISAGREEMENTS.md) with one of three verdicts:

- **spec bug**: the spec is wrong and must be changed.
- **parser bug**: the parser is wrong; the spec stands and the entry stays until the parser is fixed.
- **intentional leniency**: the parser accepts more than the spec on purpose (for example, to give better error recovery). The spec documents the strict form.

Conformance tests in `packages/dbml-parse/__tests__/conformance/` run both the reference parser and a parser generated from the spec over the same inputs and fail on any disagreement that is not recorded with a verdict. "Accept" means the reference lexer and parser report no error, and the spec parser parses without throwing. When both accept, the trees must also match: both are flattened to the same list of node kinds and token kinds in source order. The tests are currently non-blocking in CI; they become blocking once the corpus is clean.

Nothing under `packages/dbml-parse/src` changes because of the spec. The spec restates behaviour; it does not alter it.

## Layer 1 in one page

DBML source is parsed in two passes. A lexer turns UTF-16 code units into tokens and attaches whitespace and comments to neighbouring tokens as *trivia*. A recursive-descent parser then builds a small, element-agnostic tree. Element keywords such as `Table` or `Ref` are ordinary identifiers at this layer; nothing in Layer 1 knows what a table is.

### Tokens

- **Whitespace and comments** are trivia: space, tab, newline, `// ...` to end of line, and `/* ... */`. A carriage return is dropped entirely. Trivia after a token on the same line, up to and including the first newline, is that token's *trailing trivia*; trivia at the start of a line is the next token's *leading trivia*. The parser consults trivia in exactly three places, described below.
- **Identifiers** start with a Unicode letter, combining mark, or underscore and continue with those or digits. A token that starts with a digit is an identifier when it contains letters or underscores and is not a well-formed number (`12_abc`, `3a`).
- **Numbers** are `digits`, `digits . digits?`, optionally followed by an exponent `e[+-]?digits`. A number followed directly by a letter is an identifier (`1e5x`); a number with two dots or with a dot followed by letters is a lexical error (`1.2.3`, `1.a`).
- **Strings** are single-quoted `'...'` on one line or triple-quoted `'''...'''` across lines. Backslash escapes are processed, including `\uHHHH` and backslash-newline for line continuation. A newline inside a single-quoted string is an error.
- **Quoted variables** `"..."` are identifiers with arbitrary content; they follow the single-quoted string rules for escapes and newlines.
- **Function expressions** `` `...` `` are raw: no escapes, newlines allowed, ends at the first backtick.
- **Colour literals** are `#` followed by alphanumerics. Layer 1 does not check that the digits are hexadecimal.
- **Wildcard** is `*`.
- **Punctuation**: `( ) [ ] { } , :`. A semicolon is also a token, but no rule accepts it, so `;` is always an error.
- **Operators**, scanned greedily as a prefix-closed set: `. / % + - = == != ! ~ & | ?` and the relationship family `< <= > >= <> <- -> -? ?- ?-? <? ?< >? ?> ?<? ?>? <>? ?<> ?<>?`.

Anything else is a lexical error.

### Program structure

A program is a sequence of top-level statements with no separators required between them.

- **Use declaration**: `use` or `reuse` (case-insensitive), then either `*` or a braced list of newline-separated specifiers `<kind> <name> [as <alias>]`, then `from` and a string literal.
- **Element declaration**: `<type> [<target-kind>] [<name>] [as <alias>] [<attribute-list>] (: <simple-body> | <block>)`. `<type>` is an identifier; `<target-kind>` is present only when `<type>` is `metadata`. `<name>` and `<alias>` are normal expressions. A simple body is a function application and must not itself resolve to an element declaration.

### Blocks

A block `{ ... }` contains body items. An item that starts with `<identifier> :` is a *field declaration*: an element declaration with a simple body (`Note: 'text'`). Any other item is a *function application*: a callee expression followed by zero or more argument expressions on the same line, each separated by at least one space or tab. When a function application has the shape `<identifier> [<name> [as <alias>]] [<list>] <block>`, it is reinterpreted as a nested element declaration. Otherwise it stays a function application; `id integer [pk]` is the callee `id` applied to `integer` and `[pk]`.

A function application stops at a newline, at end of input, or before `}`, `]`, `)`, `,`, or `:`.

### Expressions

Each callee and argument is a *comma expression*: one or more normal expressions separated by commas, where an empty slot (`a, , c` or a trailing comma) yields an empty node. A comma continues the list only on the same line and not before a bracket or colon.

A *normal expression* is a Pratt-style operator expression over these operands:

- primary: a literal (number, string, colour) or a variable (identifier, quoted variable)
- function expression, wildcard
- list `[ attribute, ... ]`, block `{ ... }`, tuple `( expr, ... )`; a tuple with exactly one element is a *group*

Binding powers, tightest first: member access `.` (its right operand is a bare operand, never a prefix expression), prefix operators (`+ - ! ~` and every relationship operator), call `( ... )`, multiplicative `/ %`, additive `+ - -? ?- ?-?`, comparison (all relationship operators, including `->` and `<-`), equality `== !=`, assignment `=`. All infix operators are left-associative. Newlines are permitted around infix operators.

The three trivia-sensitive rules:

1. `[` directly after an operand is array indexing (`int[]`) only when no space or tab separates them on that line; otherwise it starts a new argument (`int [pk]`).
2. `(` directly after an operand is a call unless it begins a new line. Inside an unclosed `(` or `[` the newline rule is suspended, so `(f\n(1))` is a call.
3. Function-application arguments must be separated by at least one space or tab; `1 **2` is an error.

### Attribute lists

`[ attr, attr ]` where each attribute is `<name> [: <value>]`. A name is a stream of identifiers (`primary key`) or a single literal or quoted variable. A value is an identifier stream when it starts with two identifiers (`no action`), otherwise a normal expression (`> users.id`, `'text'`, `` `now()` ``). Empty names and trailing commas are errors.

### Syntax node kinds

The grammar produces exactly the `SyntaxNodeKind` set from `src/core/types/nodes.ts`: program, element-declaration, use-declaration, use-specifier, use-specifier-list, attribute, identifier-stream, literal, variable, primary-expression, prefix-expression, infix-expression, postfix-expression, function-expression, function-application, block-expression, list-expression, tuple-expression, group-expression, call-expression, comma-expression, array, wildcard, and the empty node. Postfix-expression is reachable only through error recovery today and has no grammar rule.

## Notations

The Layer 1 grammar exists in two notations that are kept in agreement by running both through the same conformance tests. This is deliberate: which notation the spec should standardise on is an open question, and the corpus gives an objective way to compare them.

| | peggy ([`dbml-syntax.peggy`](./dbml-syntax.peggy)) | ANTLR 4 ([`antlr/DbmlLexer.g4`](./antlr/DbmlLexer.g4), [`antlr/DbmlParser.g4`](./antlr/DbmlParser.g4)) |
| --- | --- | --- |
| Model | Scannerless PEG; ordered choice mirrors the reference's recursive descent | Separate lexer and parser; ALL(*) prediction with predicates where the reference commits on one token |
| Trivia | Threaded explicitly through rules (`GapAny`, `GapInline`, `GapNewline`) | Hidden channel, inspected with `getHiddenTokensToLeft()`, close to the reference lexer's trivia model |
| Embedded code | About 116 lines of JavaScript in the initializer plus one-line tree-building actions on most rules; 15 semantic predicates | 71-line members block (50 lines of JavaScript), 17 predicates, 6 actions; no tree-building code |
| Tree shaping | In the grammar | In the test harness (`__tests__/conformance/antlr.ts`, about 170 lines), because ANTLR yields a rule-shaped parse tree |
| Toolchain | `peggy` (dev dependency), compiled in memory at test time | `antlr-ng` (Node port of the ANTLR tool, no Java) generating JavaScript for the `antlr4` runtime that `@dbml/core` already uses; generated in vitest global setup, not committed |
| Unicode | Code points via `[\p{L}]u` classes | Code points via `CharStream(source, true)` |
| Corpus result | 121 of 122 snapshot inputs agree, all property tests pass | Identical |

Both notations reproduce the same recorded disagreements (see [`DISAGREEMENTS.md`](./DISAGREEMENTS.md)); the pinned cases run against each.

## Running the conformance tests

```bash
yarn workspace @dbml/parse test:conformance
```

Both grammars are compiled at test time. The peggy parser is built in memory; the ANTLR parser is generated into `packages/dbml-parse/__tests__/conformance/generated/`, which is ignored by git. No generated parser is committed.
