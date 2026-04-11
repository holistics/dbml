# DBML Playground Architecture

## Overview

The DBML Playground is a modern, multi-file DBML editor with real-time parsing, syntax highlighting, diagnostics, and visualization of the compiled database schema. It uses a **three-pane layout** (Files, Editor, Output) with **Pinia-based state management** for a clean separation between business logic and UI.

## Design Principles

This codebase follows principles from "A Philosophy of Software Design" to minimize complexity and maximize maintainability:

### 1. Deep Modules
Modules with simple interfaces and powerful internal functionality:
- **ParserStore**: Single source of truth for all parsing state, handles all compilation complexity
- **ProjectStore**: Multi-file project state management
- **Language Services**: Encapsulates Monaco Editor language features (syntax highlighting, completion, definitions)

### 2. Information Hiding
Implementation details are hidden behind well-defined interfaces:
- Parser state internals hidden from UI components
- Monaco Editor complexity hidden from consumers
- Symbol processing and data transformation encapsulated in stores
- Language services registration logic isolated

### 3. Single Responsibility
Each module handles exactly one concern:
- **ParserStore**: DBML compilation, error handling, diagnostics
- **ProjectStore**: Multi-file project management, file persistence
- **UserStore**: User preferences and UI state
- **Components**: UI presentation only
- **Language Services**: Monaco Editor language support

## Directory Structure

```
dbml-playground/
├── src/
│   ├── components/               # UI Components
│   │   ├── editor/
│   │   │   ├── MonacoEditor.vue  # Monaco Editor wrapper
│   │   │   └── dbml-language.ts  # Language service registration
│   │   ├── panes/                # Three-pane layout
│   │   │   ├── files/            # File tree pane
│   │   │   │   ├── FilesPane.vue
│   │   │   │   └── FileTreeNode.vue
│   │   │   ├── editor/           # Code editor pane
│   │   │   │   └── EditorPane.vue
│   │   │   └── output/           # Output pane
│   │   │       ├── OutputPane.vue
│   │   │       ├── tabs/         # Output tabs
│   │   │       │   ├── AstTab.vue
│   │   │       │   ├── DatabaseTab.vue
│   │   │       │   ├── DiagnosticsTab.vue
│   │   │       │   ├── SymbolsTab.vue
│   │   │       │   └── TokensTab.vue
│   │   │       └── ast/          # AST visualization
│   │   │           ├── RawAstTreeView.vue
│   │   │           └── RawAstTreeNode.vue
│   │   └── [other UI components]
│   │
│   ├── stores/                   # Pinia Stores (State Management)
│   │   ├── parserStore.ts        # Parser state, compilation, diagnostics
│   │   ├── projectStore.ts       # Multi-file project management
│   │   └── userStore.ts          # UI preferences
│   │
│   ├── services/                 # Business Logic Services
│   │   └── language-services.ts  # Monaco language service setup
│   │
│   ├── utils/                    # Utilities
│   │   ├── logger.ts             # Logging utility
│   │   └── [other utilities]
│   │
│   ├── types/                    # TypeScript Type Definitions
│   │   └── index.ts              # Shared types
│   │
│   ├── App.vue                   # Root component (3-pane layout)
│   └── main.ts                   # Application entry point
│
├── public/                       # Static assets
│   ├── dbml-logo.png
│   └── [other assets]
│
├── ARCHITECTURE.md               # This file
└── [config files]                # Build and tooling configuration (Vite, TypeScript, etc.)
```

## Core Architecture Layers

### 1. State Management (Pinia Stores)

#### ParserStore
**Responsibility**: DBML compilation, parsing, and diagnostics
**Key State**:
- `input: Ref<string>` — Current file content
- `tokens: Ref<SyntaxToken[]>` — Lexer output
- `ast: Ref<ProgramNode | null>` — Parser AST
- `symbols: Ref<SymbolInfo[]>` — Compiled symbols
- `database: Ref<Database | null>` — Final schema
- `diagnostics: Ref<ParserError[]>` — Error list
- `compiler: Compiler` — @dbml/parse compiler instance

**Key Methods**:
- `parse(input: string)` — Trigger parsing with debouncing
- `getSymbolMembers(sym: NodeSymbol)` — Get symbol children
- `buildSymbolInfo(sym: NodeSymbol)` — Transform symbol for UI display

**Hidden Complexity**:
- Debouncing (300ms) to avoid excessive recompilation
- Compiler lifecycle (create, parse, bind, check)
- Symbol transformation (removing circular refs, normalizing for UI)
- Error formatting and positioning

#### ProjectStore
**Responsibility**: Multi-file project and file management
**Key State**:
- `files: Map<string, string>` — File contents by path
- `activeFile: Ref<string>` — Currently edited file
- `fileTree: Ref<FileNode[]>` — Hierarchical file structure

**Key Methods**:
- `createFile(path: string)` — Add new file
- `updateFile(path: string, content: string)` — Update file
- `deleteFile(path: string)` — Remove file
- `selectFile(path: string)` — Switch active file

**Hidden Complexity**:
- File path validation
- File tree building from flat file list
- Project persistence (localStorage)

#### UserStore
**Responsibility**: User preferences and UI state
**Key State**:
- `theme: Ref<'light' | 'dark'>` — Editor theme
- `fontSize: Ref<number>` — Editor font size
- `[other preferences]`

### 2. Component Layer

#### Three-Pane Layout
```
┌─────────────────────────────────────┐
│          Header (App Bar)            │
├────────────┬──────────┬──────────────┤
│   Files    │  Editor  │   Output     │
│  (Tree)    │(Monaco)  │  (Tabs)      │
├────────────┼──────────┼──────────────┤
│    FilesPane.vue     │ OutputPane.vue│
│    - FilesTree       │ - AstTab      │
│    - FileTreeNode    │ - DatabaseTab │
│                      │ - SymbolsTab  │
│ EditorPane.vue       │ - TokensTab   │
│ - MonacoEditor       │ - DiagnosticsTab
│   ├─ dbml-language.ts├─ RawAstTreeView
│   └─ [syntax support]└─ [visualizations]
└────────────┴──────────┴──────────────┘
```

**Component Hierarchy**:
- `App.vue` (orchestrates layout)
  - `FilesPane` (left, file tree)
    - `FileTreeNode` (recursive file/folder)
  - `EditorPane` (center, editor)
    - `MonacoEditor` (Monaco wrapper)
  - `OutputPane` (right, output tabs)
    - Tab components (AstTab, DatabaseTab, etc.)
    - Visualization components (RawAstTreeView, etc.)

**Design Pattern**: Each component is shallow—minimal logic, maximum data binding to store

#### MonacoEditor Component
**Responsibility**: Editor lifecycle and Monaco instance
**Props**: Editor options, language, theme
**Events**: Input, selection changes
**Integration**: Provides Monaco instance to language services

#### Language Services Registration
**File**: `src/services/language-services.ts`
**Responsibility**: Configure Monaco for DBML
**Features**:
- Token provider (syntax highlighting)
- Completion provider (autocomplete)
- Hover provider (tooltips)
- Definition provider (go-to-definition)
- References provider (find-all-references)

**Integration Points**:
```typescript
registerLanguageServices(compiler)
// Registers all language features with Monaco using compiler state
```

### 3. Data Flow

```
┌──────────────────────────────────────────────────────────┐
│ User edits in MonacoEditor                               │
└────────────────┬─────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│ EditorPane → parserStore.parse(newContent)               │
│ [Debounced 300ms]                                        │
└────────────────┬─────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│ ParserStore (Pinia)                                      │
│ - Calls compiler.setSource()                             │
│ - Compiler.parse() → tokens, ast                         │
│ - Compiler.bind() + check() → diagnostics                │
│ - Extract symbols, database schema                       │
└────────────────┬─────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│ Reactive Updates                                         │
│ - MonacoEditor gets syntax highlighting                  │
│ - OutputPane tabs display results                        │
│ - Diagnostics shown in editor                            │
└──────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Pinia for State Management
**Decision**: Use Pinia instead of reactive composition APIs
**Rationale**: 
- Single source of truth for parser state
- Easier testing and debugging
- Better DevTools support
- Cleaner data flow and less prop drilling

### 2. Three-Pane Layout
**Decision**: Files (left) | Editor (center) | Output (right)
**Rationale**:
- Multi-file editing requires file navigation
- Simultaneous view of code and output aids debugging
- Scalable—easy to add more panes or tabs

### 3. Debounced Parsing
**Decision**: Debounce parser updates by 300ms
**Rationale**:
- Prevents excessive compilation on every keystroke
- Improves responsiveness (only compiles when user pauses)
- Balances UX and performance

### 4. Language Services Integration
**Decision**: Register all language features (completion, definition, etc.) via Monaco API
**Rationale**:
- Leverages Monaco's built-in infrastructure
- Consistent UX with other editors
- Easier to add new features (hover, inlay hints, etc.)

### 5. Symbol Info Transformation
**Decision**: Transform `NodeSymbol` to `SymbolInfo` in store layer
**Rationale**:
- Breaks circular references in compiler data
- Removes internal types from UI components
- Simplifies UI serialization (no cycles)

## Extensibility Points

### Adding a New Output Tab
1. Create `src/components/panes/output/tabs/NewTab.vue`
2. Add to `OutputPane.vue` tab list
3. Subscribe to `parserStore` state as needed
4. No changes to store or parser layer required

### Adding a New Language Feature
1. Implement provider in `src/services/language-services.ts`
2. Call `monaco.languages.register*Provider()` 
3. Use `parserStore.compiler` for symbol/definition queries
4. No changes to component layer required

### Adding a New Store
1. Create `src/stores/newStore.ts` with Pinia `defineStore()`
2. Import in components via `useNewStore()`
3. Follow existing store patterns (computed, actions)
4. No changes to existing stores required

## Performance Optimizations

### 1. Debounced Parsing
- Input changes trigger parse after 300ms of inactivity
- Prevents thrashing on rapid typing

### 2. Shallow Reactivity in Components
- Components use `shallowRef` for large objects (AST, symbols)
- Reduces Vue's reactivity overhead

### 3. Memoized Symbol Lookups
- `buildSymbolInfo` caches results per symbol
- Avoids recomputing for repeated queries

### 4. Monaco Instance Reuse
- Single Monaco editor instance shared across app
- Editor options (theme, fontSize) applied reactively

## Testing Strategy

### Unit Tests
- Store actions and computed properties (no DOM)
- Service functions (language features, utilities)
- Type guards and data transformers

### Integration Tests
- Component mounting with mock stores
- User interactions (typing, navigation)
- Store state updates from components

### E2E Tests (Future)
- Full editor workflow: load file, edit, see output
- Cross-file references and navigation
- Multi-file project operations

This architecture enables rapid iteration while maintaining code quality and clarity. 