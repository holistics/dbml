# RFC-20250115: DBML Parser Implementation

**Status**: IMPLEMENTED
**Last Updated**: 2025-01-15

## TLDR

The DBML parser transforms token streams into Abstract Syntax Trees (AST) using a generic grammar approach. It implements hand-written recursive descent parsing with Pratt expression parsing, enabling all DBML elements (Table, Enum, Ref, etc.) to be parsed uniformly through a universal `<type> <name> <block>` pattern without requiring grammar modifications for new element types.

## Concepts

- **Generic Grammar**: Universal `<type> <name> <block>` pattern that handles all DBML elements uniformly
- **Abstract Syntax Tree (AST)**: Hierarchical representation using generic node types, with semantic meaning deferred to later stages
- **Element Declaration**: Generic AST node representing Tables, Enums, Refs, etc. with identical structure
- **Context-Free Parsing**: Syntax analysis without semantic understanding - meaning is added in the Analyzer stage
- **Pratt Parsing**: Operator precedence parsing algorithm for complex expressions with proper associativity
- **Error Recovery**: Partial parsing that continues after syntax errors using synchronization points
- **Node Factory**: Centralized AST node creation with unique ID assignment for IDE integration

## High-level Architecture

The parser uses recursive descent with generic constructs to transform tokens into a universal AST:

```mermaid
graph LR
    A[Token Stream] --> B[Element Declaration Parser]
    B --> C[Expression Parser]
    C --> D[Block Parser]
    D --> E[Generic AST]
    E --> F[Error Recovery]
    F --> G[Complete AST]
```

**Design Decisions:**

1. **Generic Grammar**: Single `<type> <name> <block>` pattern handles all elements (Table, Enum, Ref, etc.)
2. **Hand-Written Parser**: Provides precise control over parsing logic and sophisticated error recovery
3. **Context-Free Design**: No semantic understanding during parsing - enables flexible grammar evolution
4. **Recursive Descent**: Natural mapping from grammar rules to parsing functions with predictable behavior
5. **Pratt Algorithm**: Handles complex expression parsing with operator precedence (`.` > `*` > `+` > `<` > `=`)
6. **Unified AST**: All elements use `ElementDeclarationNode`, enabling consistent tooling and analysis

**Key Innovation**: The universal element pattern means adding new DBML elements (like `View` or `Trigger`) requires no parser changes - only semantic analysis updates.

## Pipeline Architecture Deep Dive

Understanding how the parser transforms tokens into structured AST nodes:

### Element Declaration Parsing
**Purpose**: Parse the universal `<type> <name> <block>` pattern for all DBML elements.

**Key Features**:
- Single parsing function handles Table, Enum, Ref, Project, etc.
- Optional components: name, alias, attributes, body
- Generic structure preserves all information for semantic analysis

```typescript
// "Table users as u [color: '#fff'] { ... }" → ElementDeclarationNode
{
  type: 'Table',
  name: 'users',
  alias: 'u',
  attributeList: [{ name: 'color', value: '#fff' }],
  body: BlockExpressionNode
}
```

### Expression Parsing with Pratt
**Purpose**: Handle complex expressions with proper operator precedence and associativity.

**Key Features**:
- Operator precedence table (`.` > `*` > `+` > `<` > `=`)
- Left/right associativity rules
- Support for complex nested expressions

```typescript
// "schema.users.id < posts.user_id" → InfixExpressionNode tree
{
  operator: '<',
  left: { operator: '.', left: 'schema.users', right: 'id' },
  right: { operator: '.', left: 'posts', right: 'user_id' }
}
```

### Block Parsing
**Purpose**: Parse curly brace delimited content with nested elements.

**Key Features**:
- Handles both function applications (column definitions) and sub-elements
- Supports mixed content types within blocks
- Preserves structure for later semantic analysis

```typescript
// "{ id int [pk] indexes { (name) } }" → BlockExpressionNode
{
  body: [
    FunctionApplicationNode, // id int [pk]
    ElementDeclarationNode   // indexes { (name) }
  ]
}
```

### Error Recovery and Synchronization
**Purpose**: Continue parsing after syntax errors to find multiple issues.

**Key Features**:
- Synchronization points at structural boundaries
- Partial AST construction preserves valid parts
- Context-aware recovery strategies

```typescript
// "Table users { id @#$invalid name varchar }" → continues past @#$invalid
// Result: Valid table with id field marked as invalid, name field preserved
```

### AST Node Creation
**Purpose**: Build structured tree with precise position tracking and metadata.

**Key Features**:
- Unique node IDs for IDE reference tracking
- Complete source position preservation
- Parent-child relationships for context

```typescript
{
  kind: 'ElementDeclarationNode',
  id: 'node_123',
  parent: ProgramNode,
  startPos: { line: 5, column: 0 },
  endPos: { line: 12, column: 1 }
}
```

### Generic AST Output
**Purpose**: Provide uniform structure for all DBML elements enabling consistent tooling.

**Key Features**:
- All elements use same node types (ElementDeclarationNode)
- Semantic meaning deferred to Analyzer stage
- Extensible without parser modifications

## Parsing Example

To understand how the parser transforms tokens into AST, let's trace through a complete DBML example:

```dbml
Table users [note: 'Users table'] {
  id int [pk]
  name varchar(255) [not null]
  email text [unique, note: 'User email']

  Indexes {
    (name, email) [name: "user_lookup"]
  }
}

Enum user_status {
  active
  inactive [note: 'Disabled users']
}

Ref: users.id < posts.user_id
```

**Token Stream Input (from Lexer):**

```javascript
[
  // Table users [note: 'Users table'] {
  { kind: 'IDENTIFIER', value: 'Table', startPos: { line: 0, column: 0 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'users', startPos: { line: 0, column: 6 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'LBRACKET', value: '[', startPos: { line: 0, column: 12 } },
  { kind: 'IDENTIFIER', value: 'note', startPos: { line: 0, column: 13 } },
  { kind: 'COLON', value: ':', startPos: { line: 0, column: 17 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'STRING_LITERAL', value: 'Users table', startPos: { line: 0, column: 19 } },
  { kind: 'RBRACKET', value: ']', startPos: { line: 0, column: 32 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'LBRACE', value: '{', startPos: { line: 0, column: 34 } },
  { kind: 'NEWLINE', value: '\n' },

  // id int [pk]
  { kind: 'SPACE', value: '  ' },
  { kind: 'IDENTIFIER', value: 'id', startPos: { line: 1, column: 2 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'int', startPos: { line: 1, column: 5 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'LBRACKET', value: '[', startPos: { line: 1, column: 9 } },
  { kind: 'IDENTIFIER', value: 'pk', startPos: { line: 1, column: 10 } },
  { kind: 'RBRACKET', value: ']', startPos: { line: 1, column: 12 } },
  { kind: 'NEWLINE', value: '\n' },

  // name varchar(255) [not null]
  { kind: 'SPACE', value: '  ' },
  { kind: 'IDENTIFIER', value: 'name', startPos: { line: 2, column: 2 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'varchar', startPos: { line: 2, column: 7 } },
  { kind: 'LPAREN', value: '(', startPos: { line: 2, column: 14 } },
  { kind: 'NUMERIC_LITERAL', value: '255', startPos: { line: 2, column: 15 } },
  { kind: 'RPAREN', value: ')', startPos: { line: 2, column: 18 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'LBRACKET', value: '[', startPos: { line: 2, column: 20 } },
  { kind: 'IDENTIFIER', value: 'not', startPos: { line: 2, column: 21 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'null', startPos: { line: 2, column: 25 } },
  { kind: 'RBRACKET', value: ']', startPos: { line: 2, column: 29 } },
  { kind: 'NEWLINE', value: '\n' },

  // email text [unique, note: 'User email']
  { kind: 'SPACE', value: '  ' },
  { kind: 'IDENTIFIER', value: 'email', startPos: { line: 3, column: 2 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'text', startPos: { line: 3, column: 8 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'LBRACKET', value: '[', startPos: { line: 3, column: 13 } },
  { kind: 'IDENTIFIER', value: 'unique', startPos: { line: 3, column: 14 } },
  { kind: 'COMMA', value: ',', startPos: { line: 3, column: 20 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'note', startPos: { line: 3, column: 22 } },
  { kind: 'COLON', value: ':', startPos: { line: 3, column: 26 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'STRING_LITERAL', value: 'User email', startPos: { line: 3, column: 28 } },
  { kind: 'RBRACKET', value: ']', startPos: { line: 3, column: 40 } },
  { kind: 'NEWLINE', value: '\n' },

  // Empty line and Indexes block
  { kind: 'NEWLINE', value: '\n' },
  { kind: 'SPACE', value: '  ' },
  { kind: 'IDENTIFIER', value: 'Indexes', startPos: { line: 5, column: 2 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'LBRACE', value: '{', startPos: { line: 5, column: 10 } },
  { kind: 'NEWLINE', value: '\n' },
  { kind: 'SPACE', value: '    ' },
  { kind: 'LPAREN', value: '(', startPos: { line: 6, column: 4 } },
  { kind: 'IDENTIFIER', value: 'name', startPos: { line: 6, column: 5 } },
  { kind: 'COMMA', value: ',', startPos: { line: 6, column: 9 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'email', startPos: { line: 6, column: 11 } },
  { kind: 'RPAREN', value: ')', startPos: { line: 6, column: 16 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'LBRACKET', value: '[', startPos: { line: 6, column: 18 } },
  { kind: 'IDENTIFIER', value: 'name', startPos: { line: 6, column: 19 } },
  { kind: 'COLON', value: ':', startPos: { line: 6, column: 23 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'STRING_LITERAL', value: 'user_lookup', startPos: { line: 6, column: 25 } },
  { kind: 'RBRACKET', value: ']', startPos: { line: 6, column: 38 } },
  { kind: 'NEWLINE', value: '\n' },
  { kind: 'SPACE', value: '  ' },
  { kind: 'RBRACE', value: '}', startPos: { line: 7, column: 2 } },
  { kind: 'NEWLINE', value: '\n' },
  { kind: 'RBRACE', value: '}', startPos: { line: 8, column: 0 } },
  { kind: 'NEWLINE', value: '\n' },

  // Enum user_status { ... }
  { kind: 'NEWLINE', value: '\n' },
  { kind: 'IDENTIFIER', value: 'Enum', startPos: { line: 10, column: 0 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'user_status', startPos: { line: 10, column: 5 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'LBRACE', value: '{', startPos: { line: 10, column: 17 } },
  { kind: 'NEWLINE', value: '\n' },
  { kind: 'SPACE', value: '  ' },
  { kind: 'IDENTIFIER', value: 'active', startPos: { line: 11, column: 2 } },
  { kind: 'NEWLINE', value: '\n' },
  { kind: 'SPACE', value: '  ' },
  { kind: 'IDENTIFIER', value: 'inactive', startPos: { line: 12, column: 2 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'LBRACKET', value: '[', startPos: { line: 12, column: 11 } },
  { kind: 'IDENTIFIER', value: 'note', startPos: { line: 12, column: 12 } },
  { kind: 'COLON', value: ':', startPos: { line: 12, column: 16 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'STRING_LITERAL', value: 'Disabled users', startPos: { line: 12, column: 18 } },
  { kind: 'RBRACKET', value: ']', startPos: { line: 12, column: 34 } },
  { kind: 'NEWLINE', value: '\n' },
  { kind: 'RBRACE', value: '}', startPos: { line: 13, column: 0 } },
  { kind: 'NEWLINE', value: '\n' },

  // Ref: users.id < posts.user_id
  { kind: 'NEWLINE', value: '\n' },
  { kind: 'IDENTIFIER', value: 'Ref', startPos: { line: 15, column: 0 } },
  { kind: 'COLON', value: ':', startPos: { line: 15, column: 3 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'users', startPos: { line: 15, column: 5 } },
  { kind: 'OP', value: '.', startPos: { line: 15, column: 10 } },
  { kind: 'IDENTIFIER', value: 'id', startPos: { line: 15, column: 11 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'OP', value: '<', startPos: { line: 15, column: 14 } },
  { kind: 'SPACE', value: ' ' },
  { kind: 'IDENTIFIER', value: 'posts', startPos: { line: 15, column: 16 } },
  { kind: 'OP', value: '.', startPos: { line: 15, column: 21 } },
  { kind: 'IDENTIFIER', value: 'user_id', startPos: { line: 15, column: 22 } },
  { kind: 'EOF', value: '', startPos: { line: 15, column: 29 } }
]
```

**AST Structure Output:**

```typescript
ProgramNode {
  id: 1,
  kind: 'PROGRAM',
  startPos: { line: 0, column: 0, offset: 0 },
  endPos: { line: 12, column: 30, offset: 347 },
  body: [
    // Table Declaration
    ElementDeclarationNode {
      id: 2,
      kind: 'ELEMENT_DECLARATION',
      type: SyntaxToken { kind: 'IDENTIFIER', value: 'Table' },
      name: PrimaryExpressionNode {
        id: 3,
        expression: VariableNode {
          id: 4,
          variable: SyntaxToken { kind: 'IDENTIFIER', value: 'users' }
        }
      },
      attributeList: ListExpressionNode {
        id: 5,
        elementList: [
          AttributeNode {
            id: 6,
            name: PrimaryExpressionNode { /* note */ },
            colon: SyntaxToken { kind: 'COLON', value: ':' },
            value: PrimaryExpressionNode {
              expression: LiteralNode {
                literal: SyntaxToken { kind: 'STRING_LITERAL', value: 'Users table' }
              }
            }
          }
        ]
      },
      body: BlockExpressionNode {
        id: 7,
        blockOpenBrace: SyntaxToken { kind: 'LBRACE', value: '{' },
        body: [
          // Column: id int [pk]
          FunctionApplicationNode {
            id: 8,
            callee: PrimaryExpressionNode {
              expression: VariableNode {
                variable: SyntaxToken { kind: 'IDENTIFIER', value: 'id' }
              }
            },
            args: [
              PrimaryExpressionNode {
                expression: VariableNode {
                  variable: SyntaxToken { kind: 'IDENTIFIER', value: 'int' }
                }
              },
              ListExpressionNode {
                elementList: [
                  AttributeNode {
                    name: PrimaryExpressionNode { /* pk */ }
                  }
                ]
              }
            ]
          },

          // Column: name varchar(255) [not null]
          FunctionApplicationNode {
            id: 9,
            callee: PrimaryExpressionNode { /* name */ },
            args: [
              CallExpressionNode {
                id: 10,
                callee: PrimaryExpressionNode { /* varchar */ },
                argumentList: TupleExpressionNode {
                  elementList: [
                    PrimaryExpressionNode {
                      expression: LiteralNode {
                        literal: SyntaxToken { kind: 'NUMERIC_LITERAL', value: '255' }
                      }
                    }
                  ]
                }
              },
              ListExpressionNode { /* [not null] */ }
            ]
          },

          // Column: email text [unique, note: 'User email']
          FunctionApplicationNode {
            id: 11,
            callee: PrimaryExpressionNode { /* email */ },
            args: [
              PrimaryExpressionNode { /* text */ },
              ListExpressionNode {
                elementList: [
                  AttributeNode { /* unique */ },
                  AttributeNode {
                    name: PrimaryExpressionNode { /* note */ },
                    value: PrimaryExpressionNode {
                      expression: LiteralNode {
                        literal: SyntaxToken { kind: 'STRING_LITERAL', value: 'User email' }
                      }
                    }
                  }
                ]
              }
            ]
          },

          // Nested Element: Indexes { ... }
          ElementDeclarationNode {
            id: 12,
            type: SyntaxToken { kind: 'IDENTIFIER', value: 'Indexes' },
            body: BlockExpressionNode {
              body: [
                FunctionApplicationNode {
                  id: 13,
                  callee: TupleExpressionNode {
                    elementList: [
                      PrimaryExpressionNode { /* name */ },
                      PrimaryExpressionNode { /* email */ }
                    ]
                  },
                  args: [
                    ListExpressionNode {
                      elementList: [
                        AttributeNode {
                          name: PrimaryExpressionNode { /* name */ },
                          value: PrimaryExpressionNode {
                            expression: LiteralNode {
                              literal: SyntaxToken { kind: 'STRING_LITERAL', value: 'user_lookup' }
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ],
        blockCloseBrace: SyntaxToken { kind: 'RBRACE', value: '}' }
      }
    },

    // Enum Declaration
    ElementDeclarationNode {
      id: 14,
      type: SyntaxToken { kind: 'IDENTIFIER', value: 'Enum' },
      name: PrimaryExpressionNode { /* user_status */ },
      body: BlockExpressionNode {
        body: [
          FunctionApplicationNode {
            id: 15,
            callee: PrimaryExpressionNode { /* active */ },
            args: [] // No additional settings
          },
          FunctionApplicationNode {
            id: 16,
            callee: PrimaryExpressionNode { /* inactive */ },
            args: [
              ListExpressionNode {
                elementList: [
                  AttributeNode {
                    name: PrimaryExpressionNode { /* note */ },
                    value: PrimaryExpressionNode {
                      expression: LiteralNode {
                        literal: SyntaxToken { kind: 'STRING_LITERAL', value: 'Disabled users' }
                      }
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    },

    // Ref Declaration
    ElementDeclarationNode {
      id: 17,
      type: SyntaxToken { kind: 'IDENTIFIER', value: 'Ref' },
      bodyColon: SyntaxToken { kind: 'COLON', value: ':' },
      body: FunctionApplicationNode {
        id: 18,
        callee: InfixExpressionNode {
          id: 19,
          leftExpression: InfixExpressionNode {
            leftExpression: PrimaryExpressionNode { /* users */ },
            op: SyntaxToken { kind: 'OP', value: '.' },
            rightExpression: PrimaryExpressionNode { /* id */ }
          },
          op: SyntaxToken { kind: 'OP', value: '<' },
          rightExpression: InfixExpressionNode {
            leftExpression: PrimaryExpressionNode { /* posts */ },
            op: SyntaxToken { kind: 'OP', value: '.' },
            rightExpression: PrimaryExpressionNode { /* user_id */ }
          }
        },
        args: []
      }
    }
  ],
  eof: SyntaxToken { kind: 'EOF', value: '' }
}
```

**Key Observations:**

1. **Generic Structure**: All elements (Table, Enum, Ref) use `ElementDeclarationNode` with identical structure
2. **Context-Free Parsing**: Parser doesn't understand that `pk` is a table constraint - it's just an `AttributeNode`
3. **Precise Position Tracking**: Every node has exact source positions for IDE features
4. **Unified Expression Handling**: Column definitions, index definitions, and values all use the same expression node types
5. **Nested Elements**: `Indexes` element inside `Table` uses the same `ElementDeclarationNode` pattern
6. **Complex Expressions**: Relationship `users.id < posts.user_id` becomes nested `InfixExpressionNode` tree

**Complete Pipeline Flow:**

1. **DBML Source** → **Lexer** → **Token Stream**: Raw text becomes typed tokens with position tracking
2. **Token Stream** → **Parser** → **Generic AST**: Tokens become structured syntax tree (shown above)
3. **Generic AST** → **Analyzer** → **Annotated AST**: Same structure + symbol annotations:
   ```typescript
   ElementDeclarationNode { // Table users
     // ... same structure as above ...
     symbol: TableSymbol {
       declaration: /* reference to this node */,
       symbolTable: /* contains column symbols */
     }
   }
   ```
4. **Annotated AST** → **Interpreter** → **JSON Database Model**: AST unchanged, produces separate output

**Key Insight**: The parser creates the **complete structural foundation** that all subsequent stages build upon. After parsing, the AST structure never changes - only semantic annotations are added.

## Detailed Implementation

### Core Parser Architecture

**Location**: `packages/dbml-parse/src/lib/parser/parser.ts`

The parser implements a single generic parsing function for all DBML elements:

```typescript
private elementDeclaration(): ElementDeclarationNode {
  // Parse: <type> [name] [as alias] [attributes] { body } | : body
  const type = this.consume('Expect identifier', SyntaxTokenKind.IDENTIFIER);
  const name = this.optionalName();
  const { as, alias } = this.optionalAlias();
  const attributeList = this.optionalAttributes();
  const body = this.parseBody(); // Complex {...} or simple :value

  return this.nodeFactory.create(ElementDeclarationNode, {
    type, name, as, alias, attributeList, body
  });
}
```

This single function handles all these patterns uniformly:
- `Table users { ... }` - Complex body with fields
- `Enum status { active inactive }` - Block with values
- `Ref: users.id > posts.user_id` - Simple expression body
- `Project "DB" [note: 'desc'] { ... }` - Full pattern with all components

### Expression Parsing with Pratt Algorithm

**Operator Precedence Table**:
```typescript
const infixBindingPowerMap = {
  '.': { left: 16, right: 17 },   // table.field (highest)
  '*': { left: 11, right: 12 },   // multiplication
  '+': { left: 9, right: 10 },    // addition
  '<': { left: 7, right: 8 },     // relationships
  '=': { left: 2, right: 3 }      // assignment (lowest)
};
```

**Expression Types Supported**:
- Member access: `users.id`, `schema.table.field`
- Relationships: `users.id < posts.user_id`
- Function calls: `varchar(255)`, `now()`
- Complex expressions: `(users.id + 1) * 2`

### Error Recovery System

**Three-Level Recovery Strategy**:

1. **Partial Node Construction**: Preserve successfully parsed components
2. **Synchronization Points**: Resume at structural boundaries (`}`, start of line)
3. **Context-Aware Handling**: Different recovery strategies based on parsing context

```typescript
private synchronizeBlock = () => {
  markInvalid(this.advance()); // Mark error token
  while (!this.isAtEnd()) {
    const token = this.peek();
    if (this.check(SyntaxTokenKind.RBRACE) || isAtStartOfLine(this.previous(), token)) {
      break; // Found recovery point
    }
    markInvalid(this.advance());
  }
};
```

### Generic AST Structure

**Universal Node Types**:
- `ElementDeclarationNode`: All DBML elements (Table, Enum, Ref, etc.)
- `BlockExpressionNode`: Curly brace content `{ ... }`
- `FunctionApplicationNode`: Column definitions and function calls
- `InfixExpressionNode`: Relationships and operators
- `ListExpressionNode`: Attribute lists `[pk, unique]`

**Position Tracking**: Every AST node maintains precise source positions for IDE features (go-to-definition, error highlighting).

### Integration Points

**Input Interface**: Consumes token stream from Lexer with error aggregation
**Output Interface**: Produces generic AST with syntax errors for Analyzer stage
**Error Propagation**: Continues parsing after errors to report multiple issues in single pass

### Performance Characteristics

- **Time Complexity**: O(n) single pass with bounded lookahead
- **Space Complexity**: O(n) for AST with position preservation
- **Error Recovery**: Continues after errors without exponential backtracking
- **Memory Efficiency**: Token references shared, minimal duplication

## Limitations and Known Issues

### Generic Grammar Ambiguities

**Issue**: The universal grammar can create parsing ambiguities in edge cases.

**Example**:
```dbml
Table users {
  indexes name varchar(255)  // Ambiguous: column or nested element?
}
```

**Resolution**: Parser treats as function application (column); use explicit `indexes { name varchar(255) }` for element.

### Context-Free Constraints

**Issue**: Cannot enforce semantic rules during parsing (e.g., `pk` only in columns).

**Impact**: Some invalid DBML parses successfully but fails in Analyzer validation stage.

**Mitigation**: Semantic validation deferred to Analyzer component with detailed error messages.

### Expression Parsing Edge Cases

**Issue**: Complex operator precedence may not match user expectations in nested expressions.

**Workaround**: Use parentheses to clarify precedence: `(a.b).c < (d.e).f`

### Memory Usage for Large Files

**Issue**: Complete AST stored in memory with position tracking for every node.

**Impact**: Large DBML files (>10MB) may consume significant memory.

**Current Approach**: Acceptable trade-off for IDE features; streaming parser not currently needed.

### Limited Lookahead

**Issue**: Uses bounded lookahead which can affect disambiguation in complex nested structures.

**Current Strategy**: Error recovery and partial parsing handle ambiguity gracefully.

## Design Evolution

**Original Design (PEG.js)**: Grammar-specific parsing rules for each element type, requiring modifications for new elements.

**Current Design (Generic Parser)**: Universal `<type> <name> <block>` pattern with semantic analysis separated from syntax parsing.

**Key Improvements**:
- **Extensibility**: New element types require no parser changes
- **Error Recovery**: Continues parsing after errors to find multiple issues
- **IDE Support**: Precise position tracking enables advanced language services
- **Maintainability**: Single parsing logic vs. multiple element-specific parsers

**Lessons Learned**:
- Generic grammar design reduces parser complexity while maintaining flexibility
- Separating syntax from semantics improves maintainability and enables evolution
- Hand-written parsers provide better error recovery than generated alternatives
- Position tracking is essential for modern IDE integration

## Related RFCs
- [RFC-20250115: DBML Lexer Implementation](rfc-20250115-dbml-lexer.md)
- [RFC-20250115: DBML to JSON Database Model Parser](rfc-20250115-dbml-to-json-parser.md)
- [RFC-20250115: DBML Analyzer Implementation](rfc-20250115-dbml-analyzer.md)