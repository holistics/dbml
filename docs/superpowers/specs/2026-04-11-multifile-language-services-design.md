# Multi-File Language Services for DBML

**Date:** 2026-04-11  
**Scope:** Suggestions, Definitions, References providers + Filepath URI support  
**Status:** Design Approved

## Overview

Make language services (completion suggestions, go-to-definition, find-references) multi-file aware by leveraging the existing `compiler.layout` which already contains all project files. This allows users to:
- Get completion suggestions from symbols defined in other files
- Jump to definitions across files
- Find references across all project files
- Auto-insert/merge `use` statements when selecting cross-file symbols

## Current State

- **Compiler:** Already has `layout` property containing all project files
- **Language Services:** Currently single-file only via `compiler.setSource(textModel.getValue())`
- **Filepath:** Works with absolute paths; no URI support
- **Use Statements:** Manual insertion required; no auto-merge

## Proposed Changes

### 1. Filepath URI Support

**Module:** `packages/dbml-parse/src/core/types/filepath.ts`

Add URI parsing capabilities to the `Filepath` class:

```typescript
// New static method: parse file:// URIs
static fromUri(uri: string): Filepath

// New instance method: serialize to URI format
toUri(): string
```

**Behavior:**
- Parse `file:///home/user/project/main.dbml` → `/home/user/project/main.dbml`
- Serialize `/home/user/project/main.dbml` → `file:///home/user/project/main.dbml`
- Internally always store as normalized absolute paths (preserves existing behavior)
- Handle platform-specific path separators (Windows vs Unix)

**Why:** IDE integrations and multi-file editors often pass file URIs; Filepath must handle both formats transparently.

---

### 2. Language Services Multi-File Queries

**Affected Modules:**
- `packages/dbml-parse/src/services/suggestions/provider.ts`
- `packages/dbml-parse/src/services/definition/provider.ts`
- `packages/dbml-parse/src/services/references/provider.ts`

**Core Pattern:**

All three providers currently work like:
```typescript
provideXxx(model: TextModel, position: Position): Result {
  // Query compiler for current file's symbols/definitions
  const symbol = this.compiler.nodeSymbol(...);
  return ...;
}
```

**Update to:**
```typescript
provideXxx(model: TextModel, position: Position): Result {
  // Query current file first
  let result = this.compiler.nodeSymbol(...);
  
  // If not found, search compiler.layout for symbols in other files
  if (!result && this.compiler.layout) {
    result = this.searchLayout(...);
  }
  
  return result;
}
```

**New helper method:**
```typescript
private searchLayout(symbol: string, kind?: SymbolKind): LayoutSearchResult[] {
  const results: LayoutSearchResult[] = [];
  
  for (const file of this.compiler.layout.allFiles()) {
    const fileSymbols = this.compiler.layout.getSymbols(file.filepath);
    const matches = fileSymbols.filter(s => 
      s.name === symbol && (!kind || s.kind === kind)
    );
    
    results.push(...matches.map(m => ({
      symbol: m,
      file: file,
      hint: `from ${file.filepath.basename}` // For UI display
    })));
  }
  
  return results;
}
```

---

### 3. Suggestions (Completion) Provider

**File:** `packages/dbml-parse/src/services/suggestions/provider.ts`

**Changes:**

1. **Symbol lookup precedence:**
   - First check current file symbols
   - Then search `compiler.layout` for matches

2. **Completion item enhancement:**
   - Add source file as detail/description hint
   - Example: `users` (Table) → detail: `from ./common.dbml`
   - Users can see which file symbol comes from before selecting

3. **Symbol collision handling:**
   - If same symbol exists in multiple files, show all
   - Each with distinct file hint to help user choose
   - Example: `status` (Enum from ./shared.dbml) vs `status` (Enum from ./types.dbml)

4. **Cross-file selection:**
   - When user selects a cross-file symbol, trigger use-statement insertion
   - Call new `insertOrMergeUseStatement()` helper

---

### 4. Definition Provider

**File:** `packages/dbml-parse/src/services/definition/provider.ts`

**Changes:**

1. **Multi-file definition lookup:**
   - Check current file first
   - If not found, search `compiler.layout`

2. **Return all definitions:**
   - If symbol exists in multiple files (same name), return all as array of `Location`
   - Monaco editor's "peek definition" will show all locations

3. **Example behavior:**
   - User clicks on `users` table reference in current file
   - If `users` defined locally → go to local definition
   - If `users` not local but in `./common.dbml` → go to that definition
   - If `users` in multiple files → show list of definitions to choose from

---

### 5. References Provider

**File:** `packages/dbml-parse/src/services/references/provider.ts`

**Changes:**

1. **Cross-file reference search:**
   - Query all files in `compiler.layout`, not just current file
   - Return references from all files

2. **File context in results:**
   - Each reference includes the file it came from
   - Help user navigate between files

---

### 6. Use Statement Smart Merge

**New utility module:** `packages/dbml-parse/src/services/useStatementMerger.ts`

When a cross-file symbol is selected for insertion:

```typescript
interface UseStatementMerger {
  // Scan current file for existing use statements
  scanExistingUses(fileContent: string): ParsedUseStatement[];
  
  // Merge new symbol into use statements
  mergeSymbolIntoUses(
    fileContent: string,
    symbolName: string,
    sourceFile: Filepath
  ): { newContent: string; insertionPoint: Range }
}
```

**Algorithm:**

1. **Parse phase:** Extract all `use { ... } from '...'` statements from current file
2. **Match phase:** Find if `use from './sourceFile'` already exists
3. **Merge phase:**
   - If exists: append `symbolName` to import list (check for duplicates)
   - If not exists: create new `use` statement at top of file
4. **Deduplication:** Don't add symbol if already in the list
5. **Formatting:** Preserve existing whitespace/style; minimize changes

**Example:**

Current file:
```dbml
use { schema } from './common'

Table users { ... }
```

User selects `status` enum from `./common`:
```dbml
use { schema, status } from './common'  // ← symbol added

Table users { ... }
```

Another file with no existing use:
```dbml
Table orders { ... }
```

User selects `users` table from `./common`:
```dbml
use { users } from './common'           // ← new use inserted

Table orders { ... }
```

---

## Implementation Order

1. **Filepath URI support** (foundational)
   - Add `fromUri()` and `toUri()` methods
   - Update Filepath to handle both formats transparently

2. **Use statement merger** (utility)
   - Implement parsing and merging logic
   - Add tests for edge cases (duplicates, formatting, etc.)

3. **Suggestions provider** (highest impact)
   - Add layout search helper
   - Update completion items with file hints
   - Integrate use-statement insertion on selection

4. **Definition provider** (medium complexity)
   - Add layout search
   - Return all matching definitions

5. **References provider** (similar to definition)
   - Extend to search all files
   - Add file context to results

---

## Data Structures

### Layout Search Result
```typescript
interface LayoutSearchResult {
  symbol: NodeSymbol;        // The symbol found
  file: FileInfo;            // File it's in
  hint: string;              // "from ./common.dbml" for UI
}
```

### Parsed Use Statement
```typescript
interface ParsedUseStatement {
  startOffset: number;       // Where statement starts in file
  endOffset: number;         // Where statement ends
  sourceFile: string;        // './common' (relative path)
  importedSymbols: string[]; // ['schema', 'users', ...]
}
```

---

## Edge Cases & Error Handling

1. **Circular imports via use:** Allowed (per spec); language services just search; no infinite loops
2. **Symbol not found:** Return empty list; no error
3. **URI parsing failure:** Fall back to treating as absolute path
4. **Duplicate symbols across files:** Show all; let user choose
5. **Malformed use statements:** Skip them; don't break parsing

---

## Testing Strategy

- **Unit tests for Filepath URI conversion** (file:// ↔ absolute)
- **Unit tests for use statement merger** (parsing, merging, deduplication)
- **Integration tests for suggestions provider** (multi-file lookup, hints)
- **Integration tests for definition provider** (multi-file definitions)
- **Integration tests for references provider** (cross-file references)
- **E2E tests** in playground (open multiple files, verify multi-file behavior)

---

## Success Criteria

✓ User can autocomplete symbols from other files in current file  
✓ Completion items show which file they come from  
✓ Selecting cross-file symbol auto-inserts/merges `use` statement  
✓ Go-to-definition works across files  
✓ Find-references finds matches in all files  
✓ Filepath handles both `file://` URIs and absolute paths  
✓ No performance degradation for single-file projects  

---

## Notes

- **Backward compatibility:** Single-file mode unaffected; only adds search if layout exists
- **Performance:** Layout search only triggers on cache miss; cache invalidation per file
- **User experience:** File hints in suggestions help users disambiguate same-named symbols
- **Future:** Could optimize with fuzzy/smart search; incremental layout loading
