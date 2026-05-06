# DBML Playground Architecture

## Overview

Multi-file DBML editor with real-time parsing, syntax highlighting, diagnostics, and database schema visualization. Three-pane layout (Files, Editor, Output) with Pinia stores for state management.

## Directory Structure

```
dbml-playground/
├── src/
│   ├── components/
│   │   ├── SplitPanel.vue            # Generic resizable panel grid (CSS grid + drag)
│   │   ├── editor/
│   │   │   └── MonacoEditor.vue      # Monaco wrapper (lifecycle, vim, cursor tracking)
│   │   ├── monaco/
│   │   │   └── dbml-language.ts      # Monaco language registration (tokens, theme)
│   │   └── panes/
│   │       ├── files/
│   │       │   ├── FilesPane.vue     # File tree with create/rename/delete
│   │       │   └── FileTreeNode.vue  # Recursive tree node
│   │       ├── editor/
│   │       │   └── EditorPane.vue    # Editor pane (wraps MonacoEditor + settings)
│   │       └── output/
│   │           ├── OutputPane.vue    # Tab container + editor decorations
│   │           ├── tabs/
│   │           │   ├── TokensTab.vue
│   │           │   ├── AstTab.vue
│   │           │   ├── SymbolsTab.vue
│   │           │   ├── DatabaseTab.vue
│   │           │   └── DiagnosticsTab.vue
│   │           └── ast/
│   │               ├── RawAstTreeView.vue
│   │               └── RawAstTreeNode.vue
│   │
│   ├── stores/
│   │   ├── parserStore.ts            # Compiler state, parsing, diagnostics, Monaco services
│   │   ├── projectStore.ts           # Multi-file project, persistence, URL sharing
│   │   └── userStore.ts              # User preferences (vim mode, active tab)
│   │
│   ├── services/
│   │   ├── sample-content.ts         # Default DBML content
│   │   └── serializers/              # AST/symbol/token serialization for UI
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── scroll.ts
│   │   └── tokenIcons.ts
│   │
│   ├── types/index.ts
│   ├── styles/main.css               # Self-hosted Open Sans, editor decorations
│   ├── App.vue
│   └── main.ts
│
├── public/
│   ├── fonts/                        # Self-hosted Open Sans woff2 files
│   └── dbml-logo.png
│
└── ARCHITECTURE.md
```

## Stores

### parserStore
Owns a single `Compiler` instance from `@dbml/parse`. On each project file change (debounced 300ms):
1. Syncs all project files into the compiler via `setSource(filepath, content)`
2. Runs `parseFile` -> gets tokens + AST
3. Runs `interpretFile` -> gets Database schema
4. Extracts `SymbolInfo` tree from AST symbols (breaks circular refs for Vue reactivity)
5. Collects errors/warnings via `DBMLDiagnosticsProvider`

State exposed as `shallowRef` to prevent Vue from deep-proxying circular AST structures.

Registers Monaco language services (definition, references, completion) once, wrapping each call with a `syncCompilerFromModel` that pushes the editor's current text into the compiler before analysis. This avoids stale results from the 300ms debounce.

### projectStore
`files: Record<string, string>` (path -> content), `folders: string[]`, `currentFile: string`.

Persistence: localStorage (debounced 500ms). URL sharing via `CompressionStream('deflate-raw')` + base64url encoding/decoding.

### userStore
`prefs: { isVim, activeOutputTab }`. Persisted to localStorage.

## Data Flow

```
User types in MonacoEditor
  -> EditorPane updates project.currentContent (computed setter)
  -> projectStore.files[currentFile] changes
  -> parserStore watcher fires (debounced 300ms)
  -> Compiler: setSource -> parseFile -> interpretFile
  -> Reactive state updates: tokens, ast, database, symbols, errors
  -> OutputPane tabs re-render
  -> MonacoEditor markers update via updateDiagnostics
```

## Component Layer

`App.vue` uses `SplitPanel` (CSS grid with drag handles) for the three-pane layout.

Components are thin -- they read from stores and emit events. No business logic in components.

Cross-file go-to-definition works via `_codeEditorService.registerCodeEditorOpenHandler` on Monaco (internal API, guarded with `?.`). When a definition target is in a different file, App.vue switches `project.currentFile` and waits for the model swap before revealing the position.

## Key Decisions

- **shallowRef for AST/tokens/symbols**: Vue's deep reactivity proxy breaks on circular structures (SyntaxNode.parentNode, NodeSymbol.declaration). `shallowRef` avoids this.
- **No external split pane library**: `SplitPanel.vue` uses CSS grid + mousedown drag (~70 lines). Removes `splitpanes` dependency.
- **No external compression library**: `CompressionStream`/`DecompressionStream` (builtin) + base64url. Removes `lzbase62` dependency.
- **Self-hosted fonts**: Open Sans served from `public/fonts/` instead of Google Fonts CDN.
- **Monaco language config from @dbml/parse**: Monarch token provider and language config are exported from the parser package so the playground stays in sync with the grammar.
