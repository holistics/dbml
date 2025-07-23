# RFC-20250115: DBML Parser Playground

**Status**: IMPLEMENTED
**Last Updated**: 2025-01-15

## TLDR

Interactive web application for debugging and visualizing the DBML parser pipeline using the `@dbml/parse` package. Provides real-time parsing with bidirectional navigation, AST transformation, and comprehensive debugging features through a modular Vue 3 architecture that follows deep module design principles.

## Concepts

- **Parser Pipeline Visualization**: Real-time display of all parsing stages (Lexer → Parser → Analyzer → Interpreter) with structured output viewers
- **Bidirectional Navigation**: Click-to-navigate between source code, tokens, and AST nodes for debugging workflows
- **AST Transformation**: Converts raw parser output into semantic trees with metadata and source position mapping
- **Token Mapping Service**: Provides precise mapping between editor positions and lexer tokens for navigation
- **Deep Modules**: Complex functionality encapsulated behind simple interfaces (ParserService, ASTTransformerService, TokenMappingService)
- **Reactive State Management**: Vue 3 Composition API with debounced parsing and persistent user preferences
- **Monaco Editor Integration**: Professional code editor with DBML language support, vim mode, and syntax highlighting

## High-level Architecture

Layered architecture with clear separation between UI, business logic, and parser integration:

```mermaid
graph TB
    A[App.vue - UI Orchestration] --> B[useParser - Vue Composable]
    B --> C[ReactiveParser - State Management]
    C --> D[ParserService - Core Logic]
    D --> E[@dbml/parse - DBML Compiler]

    F[MonacoEditor] --> G[DBMLLanguageService]
    H[ParserOutputViewer] --> I[ASTTransformerService]
    I --> J[SemanticTreeView]

    K[TokenNavigationCoordinator] --> L[TokenMappingService]
    M[ASTDetailsPanel] --> I

    subgraph "Deep Modules - Complex Logic, Simple Interfaces"
        D
        G
        I
        K
        L
    end

    subgraph "Shallow Modules - UI Delegation"
        A
        B
        F
        H
        J
        M
    end

    subgraph "Reactive Layer"
        C
        N[useUserData]
    end
```

**Key Design Decisions:**

1. **Deep vs Shallow Modules**: Core services (ParserService, ASTTransformerService) encapsulate complexity while UI components remain simple and focused on presentation
2. **Information Hiding**: Parser implementation details are completely hidden from UI components through service abstractions
3. **Reactive Architecture**: Vue 3 Composition API separates reactive concerns from business logic
4. **Token-Source Mapping**: Bidirectional navigation system enables seamless debugging between different views

## Detailed Implementation

### Core Parser Integration (`src/core/`)

**ParserService** - Deep module wrapping `@dbml/parse`:
```typescript
export class ParserService {
  public parse(input: string): ParserResult
  // Encapsulates all Compiler complexity internally
  // Formats stage outputs consistently
  // Handles error management and formatting
}
```

Key responsibilities:
- Wraps the `@dbml/parse` Compiler with error handling
- Formats tokens, AST, and JSON outputs for UI consumption
- Provides structured error information with source locations
- Hides all parser implementation details behind simple interface

**ReactiveParser** - Vue reactivity wrapper:
```typescript
export class ReactiveParser {
  public readonly input: Ref<string>
  public readonly lexerOutput: ComputedRef<unknown>
  public readonly parserOutput: ComputedRef<unknown>
  public readonly analyzerOutput: ComputedRef<unknown>
  public readonly interpreterOutput: ComputedRef<unknown>
}
```

Features:
- Debounced parsing (300ms) to avoid excessive re-parsing during typing
- Reactive computed properties for all pipeline stages
- Automatic error handling and loading state management
- Clean separation of reactive concerns from parsing logic

**ASTTransformerService** - Semantic transformation:
```typescript
export class ASTTransformerService {
  public transformToSemantic(rawAST: any): SemanticASTNode
  public generateAccessPath(node: any, property: string): AccessPath
  public filterRawAST(rawAST: any, options: FilterOptions): any
}
```

Capabilities:
- Converts raw parser AST into user-friendly semantic trees
- Extracts table/column/enum information with proper metadata
- Generates JavaScript access paths for debugging (e.g., `ast.body[0].name`)
- Handles source position mapping for bidirectional navigation
- Evolution-resilient design using registry pattern for new element types

**TokenMappingService** - Position mapping:
```typescript
export class TokenMappingService {
  public buildMaps(tokens: Token[]): void
  public getRangeForToken(tokenIndex: number): monaco.Range | null
  public getTokenAtPosition(line: number, column: number): number | null
  public getTokensInRange(startLine: number, startColumn: number, endLine: number, endColumn: number): number[]
}
```

Functionality:
- Bidirectional mapping between Monaco editor positions and lexer tokens
- Efficient lookup structures for real-time navigation
- Handles token length calculation including quoted values
- Supports range-based token selection

### Monaco Editor Integration (`src/components/editors/`)

**MonacoEditor Component** - Professional editor wrapper:
```vue
<MonacoEditor v-model="content" language="dbml" :vim-mode="vimModeEnabled" />
```

Features:
- Custom DBML language support with syntax highlighting
- Vim mode integration with monaco-vim
- Status bar with cursor position and vim mode indicator
- Optimized configuration for performance and vim compatibility
- Event handling for navigation and keyboard shortcuts

**DBMLLanguageService** - Language definition:
```typescript
export class DBMLLanguageService {
  public static registerLanguage(): void
  public static getThemeName(): string
  // Encapsulates all Monaco language registration complexity
}
```

Provides:
- DBML syntax highlighting with monarch tokenizer
- Language configuration for auto-closing pairs and indentation
- Custom theme optimized for DBML and JSON display
- Idempotent registration (safe to call multiple times)

### UI Component Layer (`src/components/`)

**ParserOutputViewer** - Smart stage-aware viewer:
```vue
<ParserOutputViewer :data="stageOutput" @navigate-to-source="handleNavigation" />
```

Automatically routes to specialized viewers:
- **LexerView**: Token cards with metadata and JSON view
- **ParserASTView**: Tree view with raw JSON inspector
- **InterpreterView**: Semantic tree for final database model
- **JsonOutputViewer**: Monaco JSON editor for other stages

**Token Navigation System**:
- **TokenNavigationCoordinator**: Manages navigation events between components
- **Cmd/Ctrl+Click**: Navigate from source to tokens and vice versa
- **Visual feedback**: Highlight navigation mode with platform-specific hints
- **Range selection**: Multi-token selection support

### Application Coordination (`src/`)

**useParser** - Vue composable interface:
```typescript
export function useParser() {
  return {
    dbmlInput: ReactiveRef,
    isLoading: ComputedRef,
    tokens: ComputedRef,
    ast: ComputedRef,
    getStageOutput: (stage) => unknown,
    // Complex logic delegated to ReactiveParser
  }
}
```

**App.vue** - UI orchestration:
- Manages panel resizing between DBML editor and output views
- Provides dependency injection for child components
- Handles user preferences (vim mode, panel layouts, active stage)
- Delegates all business logic to composables and services

**useUserData** - Persistent state management:
```typescript
export function useUserData() {
  return {
    userData: Ref<UserData>,
    updateUserData: (key, value) => void,
    saveDbml: (content) => void,
    // Auto-saves to localStorage with debouncing
  }
}
```

### File Structure

```
dbml-playground/
├── src/
│   ├── core/                    # Deep modules - core business logic
│   │   ├── parser-service.ts    # DBML parsing wrapper
│   │   ├── reactive-parser.ts   # Vue reactivity layer
│   │   ├── ast-transformer.ts   # Semantic AST transformation
│   │   ├── token-mapping.ts     # Position-token mapping
│   │   ├── token-navigation.ts  # Navigation coordination
│   │   └── sample-content.ts    # Default DBML content
│   ├── components/              # Shallow modules - UI components
│   │   ├── editors/
│   │   │   └── MonacoEditor.vue # Editor wrapper
│   │   ├── monaco/
│   │   │   └── dbml-language.ts # Language service
│   │   └── outputs/             # Output viewers
│   │       ├── ParserOutputViewer.vue
│   │       ├── LexerView.vue
│   │       ├── ParserASTView.vue
│   │       └── InterpreterView.vue
│   ├── composables/             # Vue composables
│   │   ├── useParser.ts         # Parser composable
│   │   └── useUserData.ts       # User data management
│   ├── types/                   # Type definitions
│   │   └── index.ts             # Centralized types
│   └── App.vue                  # Main application
```

## Limitations and Known Issues

### Current Limitations

1. **Parser Evolution Brittleness**: Hardcoded element type detection in AST transformer may break when parser adds new syntax types
2. **Monaco Bundle Size**: Large bundle impact (~2MB) but necessary for professional editing experience
3. **Memory Usage**: Large AST objects for complex schemas without virtualization for extremely large files
4. **Limited Symbol Integration**: Doesn't fully leverage symbol table information from analyzer stage

### Technical Constraints

1. **Browser Compatibility**: Requires modern browsers supporting ES2020+ features
2. **AST Structure Assumptions**: Semantic transformer assumes specific element.type.value patterns
3. **Vim Mode Performance**: Some lag in cursor movement due to monaco-vim integration overhead
4. **No Advanced Parser Features**: Doesn't utilize container queries, scope resolution, or Monaco language services

### Known Technical Debt

1. **Type Definitions**: Some Monaco Editor integrations need stricter TypeScript typing
2. **Error Recovery**: Limited parser error recovery for complex syntax errors
3. **Performance**: No virtualization for extremely large DBML files (>50,000 lines)
4. **Navigation Feedback**: Visual navigation hints could be more discoverable

### Workarounds

1. **Parser Evolution**: Registry pattern allows adding new element handlers without core changes
2. **Performance**: Disabled smooth cursor animation and suggestions for better vim mode experience
3. **Bundle Size**: Lazy loading of monaco-vim to reduce initial bundle impact
4. **Memory**: Debounced parsing and reactive cleanup prevent memory leaks

## Design Evolution

### Architecture Success

The implemented architecture successfully follows "A Philosophy of Software Design" principles:

**Deep Modules Achievement**:
- `ParserService`: 200+ lines of complex `@dbml/parse` integration behind simple `parse()` method
- `ASTTransformerService`: Complex semantic transformation with simple transformation interface
- `TokenNavigationCoordinator`: Sophisticated navigation logic with event-based interface
- `DBMLLanguageService`: Complete Monaco language registration in self-contained module

**Information Hiding Success**:
- Parser implementation details completely hidden from UI components
- Reactive state management separated from parsing logic  
- Complex error handling and formatting encapsulated in services
- Monaco editor configuration abstracted behind simple Vue component

**Shallow Modules Working Well**:
- `useParser` composable: 87 lines of delegation vs 200+ lines of complex logic
- UI components focus purely on presentation, delegate to services
- Clean separation enables independent testing and component development

### Key Insights

1. **Modular Architecture Wins**: Clear service boundaries make debugging and feature addition straightforward
2. **Deep Module Investment**: Powerful internal functionality with simple interfaces dramatically improves maintainability
3. **Vue 3 Composition API**: Enables clean separation between reactive and business logic without coupling
4. **Parser Integration Strategy**: Wrapping complex parser in simple service interface scales well

### Performance Optimizations Applied

1. **Monaco Editor Configuration**: Disabled smooth cursor animation, suggestions, and GPU hints for vim mode
2. **Debounced Parsing**: 300ms debounce prevents excessive parsing during typing
3. **Reactive Computation**: Computed properties ensure minimal re-computation
4. **Bundle Optimization**: Lazy loading of monaco-vim reduces initial load time

The playground successfully provides a comprehensive debugging environment while maintaining clean architecture and good performance characteristics. The modular design enables easy extension and maintenance as the DBML parser continues to evolve. 