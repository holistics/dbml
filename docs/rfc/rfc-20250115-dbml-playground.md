# RFC-20250115: DBML Parser Playground

**Status**: IMPLEMENTED
**Last Updated**: 2025-01-15

## TLDR

The DBML Playground is an interactive web application for debugging and visualizing the DBML parser pipeline. It provides real-time parsing with syntax highlighting, pipeline stage visualization, and comprehensive error reporting. The system is built using Vue 3 with a modular architecture that separates concerns and follows software design principles for maintainability and extensibility.

## Concepts

- **Parser Pipeline Visualization**: Real-time display of all four parsing stages (Lexer → Parser → Analyzer → Interpreter)
- **Reactive Parsing**: Automatic parsing with debouncing as users type DBML content
- **Stage Output Inspection**: Interactive viewing of intermediate results from each pipeline stage
- **Syntax Highlighting**: Custom DBML language support in Monaco Editor with full tokenization
- **Error Visualization**: Comprehensive error reporting with precise location information
- **Deep Modules**: Architectural pattern where modules have simple interfaces but powerful internal functionality
- **Information Hiding**: Design principle where implementation details are hidden from consumers
- **Single Responsibility**: Each module handles exactly one concern or abstraction level

## High-level Architecture

The playground follows a layered architecture with clear separation of concerns:

```mermaid
graph TB
    A[App.vue - UI Orchestration] --> B[useParser - Vue Composable]
    B --> C[ReactiveParser - State Management]
    C --> D[ParserService - Core Logic]
    D --> E[@dbml/parse - DBML Compiler]

    F[MonacoEditor] --> G[DBMLLanguageService]
    H[JsonViewer] --> I[Data Transformation]

    J[SampleContent] --> C

    subgraph "Deep Modules"
        D
        G
    end

    subgraph "Shallow Modules"
        A
        B
        F
        H
    end
```

**Design Principles Applied:**

1. **Modular Architecture**: Clear separation between UI, business logic, and services
2. **Deep Modules**: Core services (ParserService, DBMLLanguageService) encapsulate complexity
3. **Shallow Modules**: UI components have simple interfaces that delegate to deep modules
4. **Information Hiding**: Implementation details are hidden behind well-defined interfaces
5. **Single Responsibility**: Each module handles exactly one concern
6. **General Purpose**: Services are designed to be reusable and extensible

## Detailed Implementation

### Core Architecture Components

#### 1. Parser Service Layer (`src/core/`)

**ParserService** - Deep module for DBML parsing:
```typescript
export class ParserService {
  public parse(input: string): ParserResult
  // All complexity hidden internally
}
```

- Encapsulates all interaction with `@dbml/parse`
- Handles error management and output formatting
- Provides simple interface hiding complex parsing logic
- Immutable result objects with readonly properties

**ReactiveParser** - Reactive wrapper for Vue integration:
```typescript
export class ReactiveParser {
  public readonly input: Ref<string>
  public readonly isLoading: Ref<boolean>
  // Computed reactive outputs for each stage
}
```

- Manages debouncing and reactive state
- Separates reactive concerns from core parsing logic
- Provides Vue-compatible reactive interface

**SampleContent** - Centralized content management:
```typescript
export const SAMPLE_CATEGORIES: readonly SampleCategory[]
export function getSampleContent(categoryName: string): string | null
```

- Manages all sample DBML content
- Provides extensible interface for adding new examples
- Hides content details from consumers

#### 2. Component Layer (`src/components/`)

**MonacoEditor** - Clean editor wrapper:
```vue
<MonacoEditor
  v-model="content"
  language="dbml"
  :read-only="false"
/>
```

- Delegates language support to `DBMLLanguageService`
- Focuses only on editor lifecycle and events
- Simple prop-based interface

**DBMLLanguageService** - Monaco language support:
```typescript
export class DBMLLanguageService {
  public static registerLanguage(): void
  public static getLanguageId(): string
  public static getThemeName(): string
}
```

- Encapsulates all Monaco Editor language complexity
- Provides idempotent registration
- Hides tokenization and theme details

**JsonViewer** - Data display component:
```vue
<JsonViewer :data="stageOutput" />
```

- Handles data transformation for optimal display
- Encapsulates vue-json-viewer complexity
- Provides consistent styling

#### 3. Application Layer (`src/`)

**useParser** - Vue composable:
```typescript
export function useParser() {
  return {
    dbmlInput: ReactiveRef,
    isLoading: ComputedRef,
    getStageOutput: (stage) => unknown,
    // Simple interface delegating to services
  }
}
```

- Shallow module that coordinates deep modules
- Provides Vue-friendly interface
- Minimal logic, maximum delegation

**App.vue** - UI orchestration:
- Focuses solely on UI layout and user interactions
- Delegates all business logic to composables and services
- Uses clear separation between presentation and logic

### Key Design Decisions

#### 1. Deep vs Shallow Module Strategy

**Deep Modules** (High functionality, Simple interface):
- `ParserService`: Complex parsing logic, simple `parse()` method
- `DBMLLanguageService`: Complex language definition, simple registration
- `ReactiveParser`: Complex reactivity management, simple reactive properties

**Shallow Modules** (Simple interface, delegates to deep modules):
- `useParser`: Thin wrapper providing Vue-compatible interface
- UI Components: Focus on presentation, delegate logic to services

#### 2. Information Hiding Implementation

```typescript
// Hidden: Complex parser interaction
private formatTokensForDisplay(tokens: any[]): unknown
private formatASTForDisplay(ast: any): unknown
private formatJSONForDisplay(json: any): unknown

// Exposed: Simple, typed interface
public parse(input: string): ParserResult
```

#### 3. Error Handling Strategy

- Structured error types with precise location information
- Graceful degradation for parsing failures
- Error boundaries prevent cascade failures
- User-friendly error display with technical details

#### 4. Performance Considerations

- Debounced parsing (300ms) to avoid excessive computation
- Lazy language registration in Monaco Editor
- Efficient reactive updates using Vue's computed properties
- Memory cleanup in component lifecycle hooks

### Technology Integration

#### Vue 3 + TypeScript
- Composition API for better logic organization
- TypeScript for type safety and documentation
- Reactive system for automatic UI updates

#### Monaco Editor Integration
- Custom DBML language with full tokenization
- Professional code editing experience
- Configurable themes and settings

#### Tailwind CSS
- Utility-first styling approach
- Consistent design system
- Responsive layout support

#### Vite Build System
- Fast development with HMR
- Optimized production builds
- Modern ES modules support

### Testing Strategy

The modular architecture enables targeted testing:

```typescript
// Unit tests for core services
describe('ParserService', () => {
  it('should parse valid DBML', () => {
    const service = new ParserService()
    const result = service.parse('Table users { id int [pk] }')
    expect(result.success).toBe(true)
  })
})

// Integration tests for reactive layer
describe('ReactiveParser', () => {
  it('should debounce input changes', async () => {
    // Test debouncing behavior
  })
})

// Component tests for UI
describe('MonacoEditor', () => {
  it('should register DBML language', () => {
    // Test component integration
  })
})
```

## Limitations and Known Issues

### Current Limitations

1. **Monaco Editor Bundle Size**: Large bundle impact, but necessary for professional editing experience
2. **Memory Usage**: AST objects can be large for complex schemas, but this is inherent to the parsing process
3. **Browser Compatibility**: Requires modern browsers supporting ES2020+ features

### Technical Debt

1. **Type Definitions**: Some dependencies (vue-json-viewer) lack complete TypeScript definitions
2. **Error Recovery**: Limited parser error recovery compared to production parsers
3. **Performance**: No virtualization for very large DBML files (>10,000 lines)

### Future Enhancements

1. **Export Functionality**: Add ability to export parsed results in various formats
2. **Import Samples**: Allow users to load external DBML files
3. **Collaborative Editing**: Real-time collaborative features
4. **Advanced Error Analysis**: More sophisticated error explanations and suggestions
5. **Performance Profiling**: Add timing information for each pipeline stage

## Design Evolution

### Original Architecture Issues

The initial implementation suffered from several design problems:

1. **Shallow Modules**: Components had complex interfaces but limited functionality
2. **Information Leakage**: Parser logic scattered across multiple files
3. **Special-General Mixture**: Formatting logic mixed with business logic
4. **Temporal Decomposition**: Structure followed execution order rather than abstractions

### Refactoring Process

**Step 1: Created Deep Modules**
- `ParserService`: Encapsulated all parsing complexity
- `DBMLLanguageService`: Centralized Monaco Editor language support
- Each module provides simple interface with powerful internal functionality

**Step 2: Separated Concerns**
- Reactive logic separated from core parsing
- UI components separated from business logic
- Sample content management separated from parsing

**Step 3: Applied Information Hiding**
- Internal implementation details hidden behind clean interfaces
- Complex error handling and formatting logic encapsulated
- Monaco Editor complexity hidden behind service interface

**Step 4: Eliminated Information Leakage**
- All parser knowledge centralized in `ParserService`
- Language definition centralized in `DBMLLanguageService`
- No cross-cutting concerns requiring knowledge in multiple modules

### Lessons Learned

1. **Deep Modules Principle**: Investing in powerful internal functionality with simple interfaces dramatically improves maintainability
2. **Information Hiding Value**: Hiding implementation details enables independent evolution of modules
3. **Single Responsibility Benefits**: Clear module boundaries make debugging and testing much easier
4. **General Purpose Design**: Designing for reusability leads to cleaner, more flexible architecture

### Architecture Benefits

**Before Refactoring:**
- 200+ lines of complex logic in `useParser` composable
- Language definition mixed with component logic
- Difficult to test individual components
- High coupling between modules

**After Refactoring:**
- 50 lines in simplified `useParser` composable
- Clean separation of concerns across modules
- Each module easily testable in isolation
- Low coupling, high cohesion architecture

The refactored architecture follows "A Philosophy of Software Design" principles:
- Deep modules that hide complexity
- Information hiding preventing design decisions from leaking
- Clear abstractions that remain consistent across layers
- Pull complexity downwards to benefit module users

## Related RFCs
- [RFC-20250115: DBML to JSON Database Model Parser](rfc-20250115-dbml-to-json-parser.md)
- [RFC-20250115: DBML Lexer Implementation](rfc-20250115-dbml-lexer.md)
- [RFC-20250115: DBML Parser Implementation](rfc-20250115-dbml-parser.md)
- [RFC-20250115: DBML Analyzer Implementation](rfc-20250115-dbml-analyzer.md)
- [RFC-20250115: DBML Interpreter Implementation](rfc-20250115-dbml-interpreter.md)