# DBML Playground Architecture

## Design Principles

This codebase follows principles from "A Philosophy of Software Design" to minimize complexity and maximize maintainability:

### 1. Deep Modules
Modules with simple interfaces and powerful internal functionality:
- `ParserService`: Single `parse()` method, handles all parsing complexity
- `DBMLLanguageService`: Simple registration, encapsulates Monaco language definition
- `ReactiveParser`: Clean reactive interface, manages complex state and debouncing

### 2. Information Hiding
Implementation details are hidden behind well-defined interfaces:
- Parser internals hidden from UI components
- Monaco Editor complexity hidden from consumers
- Error formatting and data transformation logic encapsulated

### 3. Single Responsibility
Each module handles exactly one concern:
- **ParserService**: DBML parsing and formatting
- **ReactiveParser**: Vue reactivity and state management
- **DBMLLanguageService**: Monaco Editor language support
- **SampleContent**: Content management
- **Components**: UI presentation only

## Directory Structure

```
dbml-playground/
├── src/
│   ├── core/                     # Deep modules - Core business logic
│   │   ├── parser-service.ts     # DBML parsing with simple interface
│   │   ├── reactive-parser.ts    # Vue reactivity wrapper
│   │   └── sample-content.ts     # Centralized content management
│   │
│   ├── components/               # Shallow modules - UI components
│   │   ├── editors/
│   │   │   └── MonacoEditor.vue  # Clean editor wrapper
│   │   ├── outputs/
│   │   │   └── JsonViewer.vue    # Data display component
│   │   └── monaco/
│   │       └── dbml-language.ts  # Monaco language support
│   │
│   ├── composables/              # Vue integration layer
│   │   └── useParser.ts          # Simple Vue composable
│   │
│   ├── styles/                   # Styling
│   │   └── main.css
│   │
│   ├── App.vue                   # UI orchestration
│   └── main.ts                   # Application entry point
│
├── public/                       # Static assets
│   └── examples/                 # Sample DBML files
│
├── docs/
│   └── ARCHITECTURE.md           # This file
│
└── [config files]                # Build and tooling configuration
```

## Module Responsibilities

### Core Layer (`src/core/`)

#### ParserService
**Type**: Deep Module
**Responsibility**: DBML parsing and output formatting
**Interface**: 
```typescript
class ParserService {
  parse(input: string): ParserResult
}
```
**Hidden Complexity**: 
- @dbml/parse integration
- Error handling and transformation
- Output formatting for each pipeline stage
- Data structure normalization

#### ReactiveParser
**Type**: Reactive Wrapper
**Responsibility**: Vue reactivity and state management
**Interface**:
```typescript
class ReactiveParser {
  readonly input: Ref<string>
  readonly isLoading: Ref<boolean>
  readonly lexerOutput: ComputedRef<unknown>
  // ... other reactive properties
}
```
**Hidden Complexity**:
- Debouncing logic
- State synchronization
- Error state management
- Reactive property coordination

#### SampleContent
**Type**: Content Module
**Responsibility**: Sample DBML content management
**Interface**:
```typescript
const SAMPLE_CATEGORIES: readonly SampleCategory[]
function getSampleContent(name: string): string | null
```
**Hidden Complexity**:
- Content organization
- Category management
- Default content selection

### Component Layer (`src/components/`)

#### MonacoEditor
**Type**: Shallow Module
**Responsibility**: Monaco Editor lifecycle and events
**Interface**: Standard Vue component props
**Delegated Complexity**: Language registration to `DBMLLanguageService`

#### DBMLLanguageService
**Type**: Deep Module
**Responsibility**: Monaco Editor DBML language support
**Interface**:
```typescript
class DBMLLanguageService {
  static registerLanguage(): void
  static getLanguageId(): string
  static getThemeName(): string
}
```
**Hidden Complexity**:
- Token provider definition
- Language configuration
- Theme definition
- Registration state management

#### JsonViewer
**Type**: Shallow Module
**Responsibility**: JSON data display
**Interface**: Simple data prop
**Hidden Complexity**: Data transformation logic

### Integration Layer (`src/composables/`)

#### useParser
**Type**: Shallow Module
**Responsibility**: Vue composable interface
**Interface**: Vue-compatible reactive objects
**Strategy**: Minimal logic, maximum delegation to `ReactiveParser`

## Data Flow

```mermaid
graph LR
    A[User Input] --> B[MonacoEditor]
    B --> C[useParser]
    C --> D[ReactiveParser]
    D --> E[ParserService]
    E --> F[@dbml/parse]
    
    F --> E
    E --> D
    D --> C
    C --> G[App.vue]
    G --> H[JsonViewer]
    G --> I[Error Display]
```

## Design Benefits

### Maintainability
- Clear module boundaries make debugging straightforward
- Changes to parsing logic only affect `ParserService`
- UI changes don't impact business logic
- Language support changes isolated to `DBMLLanguageService`

### Testability
- Each module can be tested in isolation
- Deep modules have clear input/output contracts
- Mocking is straightforward due to clean interfaces
- UI logic is separated from business logic

### Extensibility
- New pipeline stages: Modify `ParserService` only
- New sample content: Add to `SampleContent` module
- New editor features: Extend `MonacoEditor` without touching parser
- New output formats: Extend `ParserService` formatting

### Performance
- Debouncing handled in reactive layer, not UI
- Language registration is lazy and idempotent
- Reactive updates are minimal due to computed properties
- Memory cleanup is centralized in component lifecycle

## Anti-Patterns Avoided

### Before Refactoring (Anti-patterns)
- **Shallow Modules**: Components with complex interfaces but little functionality
- **Information Leakage**: Parser details scattered across multiple files
- **Temporal Decomposition**: Structure followed execution order
- **Special-General Mixture**: Formatting mixed with business logic

### After Refactoring (Good Patterns)
- **Deep Modules**: Complex functionality behind simple interfaces
- **Information Hiding**: Implementation details completely encapsulated
- **Abstraction-Based Decomposition**: Structure follows logical abstractions
- **Separation of Concerns**: Each concern handled by dedicated module

## Key Architectural Decisions

### 1. Service Classes vs Functions
**Decision**: Use classes for stateful services, functions for utilities
**Rationale**: Classes provide clear encapsulation and state management for complex services

### 2. Reactive Wrapper Pattern
**Decision**: Separate reactive concerns from core logic
**Rationale**: Enables testing core logic without Vue dependencies and reuse in different contexts

### 3. Language Service Singleton
**Decision**: Static methods for Monaco language registration
**Rationale**: Language registration is global state; singleton prevents conflicts

### 4. Immutable Result Objects
**Decision**: All parser results use readonly properties
**Rationale**: Prevents accidental mutations and makes data flow explicit

### 5. Composable as Coordination Layer
**Decision**: Keep useParser thin and focused on coordination
**Rationale**: Avoids the common anti-pattern of "God composables" that do everything

This architecture prioritizes long-term maintainability over short-term convenience, following the principle that code is read far more often than it's written. 