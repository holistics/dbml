# RFC-20250115: DBML Parser Playground

**Status**: IMPLEMENTED
**Last Updated**: 2025-01-15

## TLDR

Interactive web application for debugging and visualizing the DBML parser pipeline using the new `@dbml/parse` package. Provides real-time parsing with syntax highlighting, semantic AST visualization, and comprehensive debugging features through a modular Vue 3 architecture.

## Concepts

- **Parser Pipeline Visualization**: Real-time display of all four parsing stages (Lexer → Parser → Analyzer → Interpreter)
- **Semantic AST Transformation**: Converts raw parser AST into user-friendly semantic trees with navigation support
- **Bidirectional Navigation**: Click between source code and parsed tokens/AST nodes for debugging
- **Stage Output Inspection**: Interactive viewing of intermediate results from each pipeline stage
- **Access Path Generation**: Debug-friendly JavaScript paths for navigating raw AST structures
- **Deep Modules**: Complex functionality hidden behind simple interfaces (ParserService, ASTTransformerService)
- **Shallow Modules**: UI components that delegate to deep modules (App.vue, useParser composable)

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

    subgraph "Deep Modules"
        D
        G
        I
        K
        L
    end

    subgraph "Shallow Modules"
        A
        B
        F
        H
        J
        M
    end
```

**Key Design Decisions:**
- **Deep modules** (ParserService, ASTTransformerService) encapsulate complexity with simple interfaces
- **Shallow modules** (UI components) delegate to deep modules and focus on presentation
- **Information hiding** prevents parser implementation details from leaking to UI
- **Reactive state management** using Vue 3 Composition API with debounced parsing

## Detailed Implementation

### Core Parser Integration (`src/core/`)

**ParserService** - Deep module wrapping `@dbml/parse`:
```typescript
export class ParserService {
  public parse(input: string): ParserResult
  // Hides all Compiler complexity internally
}
```
- Encapsulates all interaction with `@dbml/parse` Compiler
- Handles stage-specific formatting (tokens, AST, analyzer, interpreter)
- Provides immutable results with structured error information

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
- Manages debounced parsing (300ms) and reactive state
- Separates reactive concerns from core parsing logic

**ASTTransformerService** - Semantic transformation:
```typescript
export class ASTTransformerService {
  public transformToSemantic(rawAST: any): SemanticASTNode
  public generateAccessPath(node: any, property: string): AccessPath
  public filterRawAST(rawAST: any, options: FilterOptions): any
}
```
- Converts raw parser AST into user-friendly semantic trees
- Extracts table/column/enum information with proper metadata
- Generates JavaScript access paths for debugging
- Handles source position mapping for navigation

### UI Component Layer (`src/components/`)

**MonacoEditor** - Professional code editor:
```vue
<MonacoEditor v-model="content" language="dbml" :vim-mode="vimModeEnabled" />
```
- Custom DBML language support through DBMLLanguageService
- Vim mode toggle, syntax highlighting, error indicators
- Integrated with navigation system for cursor positioning

**ParserOutputViewer** - Smart stage-aware viewer:
```vue
<ParserOutputViewer :data="stageOutput" @navigate-to-source="handleNavigation" />
```
- Automatically detects data type (tokens, AST, JSON)
- Delegates to specialized viewers (LexerView, ParserASTView, JsonOutputViewer)
- Handles navigation events between components

**ParserASTView** - Dual-mode AST visualization:
- **Semantic view**: User-friendly tree with icons, descriptions, and metadata
- **Raw JSON view**: Direct AST inspection with Monaco editor
- Interactive node selection, expansion, and source navigation
- Advanced filtering and search capabilities

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
    // All complex logic delegated to ReactiveParser
  }
}
```

**App.vue** - UI orchestration only:
- Manages panel resizing, navigation state, and user preferences
- Provides dependency injection for child components
- Delegates all business logic to composables and services

### Advanced Features

**Token Navigation System**:
- **TokenNavigationCoordinator**: Manages bidirectional navigation between source and tokens
- **TokenMappingService**: Maps source positions to token positions
- Click on tokens to highlight source code, click on source to highlight tokens

**User Data Persistence**:
- Auto-saves DBML content to localStorage with debouncing
- Persists user preferences (vim mode, panel layouts, view modes)
- Restores state on page reload

**Comprehensive Error Display**:
- Structured error reporting with precise location information
- User-friendly error messages with technical details
- Navigation from errors to source code positions

## Limitations and Known Issues

### Current Implementation Issues

1. **Parser Evolution Brittleness**: Hardcoded element type detection breaks when parser adds new syntax types
2. **Limited Symbol Integration**: Doesn't leverage symbol table information from analyzer stage
3. **Monaco Bundle Size**: Large bundle impact (~2MB) but necessary for professional editing
4. **No Advanced Parser Features**: Doesn't use container queries, scope resolution, or Monaco services

### Technical Constraints

1. **Hardcoded AST Structure Assumptions**: Semantic transformer assumes specific element.type.value structure
2. **No Fallback Handling**: Unknown element types cause transformation to fail
3. **Browser Compatibility**: Requires modern browsers supporting ES2020+ features
4. **Memory Usage**: Large AST objects for complex schemas without virtualization

### Known Technical Debt

1. **Type Definitions**: Some Monaco Editor integrations need stricter typing
2. **Error Recovery**: Limited parser error recovery for syntax errors
3. **Performance**: No virtualization for extremely large DBML files (>50,000 lines)

## Design Evolution

### Architecture Success

The implemented architecture successfully follows "A Philosophy of Software Design" principles:

**Deep Modules Achievement**:
- `ParserService`: Complex `@dbml/parse` integration with simple `parse()` interface
- `ASTTransformerService`: Complex semantic transformation with simple transformation methods
- `TokenNavigationCoordinator`: Complex navigation logic with simple event-based interface

**Information Hiding Success**:
- Parser implementation details completely hidden from UI components
- Reactive state management separated from parsing logic
- Complex error handling and formatting encapsulated in services

**Shallow Modules Working Well**:
- `useParser` composable: 50 lines of delegation vs 200+ lines of complex logic
- UI components focus on presentation, delegate business logic to services
- Clean separation enables independent testing and development

### Key Insights

1. **Modular Architecture Wins**: Clear boundaries make debugging and feature addition straightforward
2. **Deep Module Investment**: Powerful internal functionality with simple interfaces dramatically improves maintainability
3. **Vue 3 Composition API**: Enables clean separation between reactive and business logic
4. **Parser Integration Strategy**: Wrapping complex parser in simple service interface works well

### Future Architecture Needs

The current implementation provides a solid foundation but needs evolution to handle:
- Parser syntax evolution without breaking changes
- Advanced symbol table integration for richer debugging
- Enhanced semantic relationship visualization
- Better integration with parser's advanced features (container queries, Monaco services)