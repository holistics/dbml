# Implementation Plan: Multi-File Language Services

**Based on:** `2026-04-11-multifile-language-services-design.md`  
**Target Branch:** `feat/module-system-2`  
**Estimated Scope:** 5-7 tasks

---

## Phase 1: Foundation (Filepath URI Support)

### Task 1.1: Add URI parsing to Filepath class

**File:** `packages/dbml-parse/src/core/types/filepath.ts`

**Changes:**
1. Add new static method: `Filepath.fromUri(uri: string): Filepath`
   - Parse `file:///path/to/file.dbml` format
   - Handle platform-specific separators (backslashes on Windows)
   - Convert to absolute path using `new Filepath(absolutePath)`
   - Return the constructed Filepath

2. Add new instance method: `toUri(): string`
   - Convert internal absolute path to URI format
   - Return `file:///${this.path}` (normalized)
   - Handle platform path separators

3. Add unit tests:
   - Test `fromUri('file:///home/user/main.dbml')` → `/home/user/main.dbml`
   - Test `toUri()` round-trip conversion
   - Test Windows paths with backslashes
   - Test edge cases (relative paths, malformed URIs)

**Dependencies:** None (foundational)

---

## Phase 2: Use Statement Merging (Pre-requisite for Suggestions)

### Task 2.1: Create UseStatementMerger utility

**New File:** `packages/dbml-parse/src/services/useStatementMerger.ts`

**Exports:**
```typescript
interface UseStatementMerger {
  scanExistingUses(fileContent: string): ParsedUseStatement[];
  mergeSymbolIntoUses(
    fileContent: string,
    symbolName: string,
    sourceFile: Filepath
  ): UseStatementMergeResult;
}

interface ParsedUseStatement {
  startOffset: number;
  endOffset: number;
  sourceFile: string;          // './common' relative path
  importedSymbols: string[];
}

interface UseStatementMergeResult {
  newContent: string;
  editStartOffset: number;
  editEndOffset: number;
  hint?: string;               // "merged into existing" vs "created new"
}
```

**Implementation:**
1. `scanExistingUses(fileContent)`:
   - Regex: `/use\s*\{\s*([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g`
   - For each match: extract symbol names, source file path, offsets
   - Return array of ParsedUseStatement
   
2. `mergeSymbolIntoUses(fileContent, symbolName, sourceFile)`:
   - Call `scanExistingUses(fileContent)` to find existing uses
   - Find match where `sourceFile` path matches
   - If match found:
     - Check if `symbolName` already in import list (deduplicate)
     - Insert `symbolName` into existing use statement
     - Return merged content + edit range
   - If not found:
     - Create new `use { ${symbolName} } from '${sourceFilePath}'`
     - Insert at top of file (after any existing uses)
     - Return updated content + insertion range

3. Unit tests:
   - Test: existing use → add new symbol to list
   - Test: no existing use → create new one
   - Test: deduplication (don't add symbol twice)
   - Test: multiple use statements (merge into correct one)
   - Test: formatting preservation (whitespace, quotes)

**Dependencies:** None (utility, standalone)

---

## Phase 3: Suggestions Provider (Completion)

### Task 3.1: Add layout search helper to suggestions provider

**File:** `packages/dbml-parse/src/services/suggestions/provider.ts`

**Changes:**

1. Add private helper method:
```typescript
private searchLayout(symbolName: string, kind?: SymbolKind): LayoutSearchResult[] {
  if (!this.compiler.layout) return [];
  
  const results: LayoutSearchResult[] = [];
  const allFiles = this.compiler.layout.allFiles();
  
  for (const fileInfo of allFiles) {
    const symbols = this.compiler.layout.getSymbols(fileInfo.filepath);
    
    const matches = symbols.filter(sym =>
      sym.name === symbolName && (!kind || sym.kind === kind)
    );
    
    results.push(...matches.map(sym => ({
      symbol: sym,
      file: fileInfo,
      hint: `from ${fileInfo.filepath.basename}`
    })));
  }
  
  return results;
}
```

2. Update `provideCompletionItems()`:
   - After current file lookup fails → call `searchLayout()`
   - For each result, create completion item with:
     - Label: symbol name
     - Detail: file hint (`from ./common.dbml`)
     - Kind: map symbol kind to CompletionItemKind
     - SortText: prefix with `zzz_` to show after local symbols (optional)

3. Add on-selection handler:
   - When user selects a cross-file completion:
     - Use `UseStatementMerger.mergeSymbolIntoUses()` to get updated content
     - Return completion item with `additionalTextEdits` array:
       - One edit to insert the symbol at cursor
       - One edit to insert/merge the use statement at top

4. Unit tests:
   - Test: local symbol found → no layout search
   - Test: symbol not local → layout search returns matches
   - Test: same symbol in multiple files → all shown with distinct hints
   - Test: on-selection → use statement auto-inserted

**Dependencies:** Task 1.1 (Filepath), Task 2.1 (UseStatementMerger)

---

## Phase 4: Definition Provider

### Task 4.1: Add layout search to definition provider

**File:** `packages/dbml-parse/src/services/definition/provider.ts`

**Changes:**

1. Update `provideDefinition()`:
   - Keep existing logic for current file
   - If symbol not found locally:
     - Call layout search (similar to suggestions)
     - Return array of `Location` for all matches
   - Monaco editor handles array of locations (peek definition)

2. Add private helper (same pattern as suggestions):
```typescript
private searchLayout(symbolName: string): LayoutSearchResult[] {
  // Same implementation as suggestions
}
```

3. Return type handling:
   - Single definition → return `Location`
   - Multiple definitions → return `Location[]`
   - No definition → return `undefined`

4. Unit tests:
   - Test: local definition found → single location
   - Test: symbol in other file → location from that file
   - Test: same symbol in multiple files → array of locations

**Dependencies:** Task 1.1 (Filepath), Task 3.1 (suggestions provider pattern)

---

## Phase 5: References Provider

### Task 5.1: Add layout search to references provider

**File:** `packages/dbml-parse/src/services/references/provider.ts`

**Changes:**

1. Update `provideReferences()`:
   - Current implementation likely searches current file only
   - Extend to search all files in `compiler.layout`
   - Return combined array of `Location[]` from all files

2. Implementation:
   - Call `compiler.symbolReferences(symbol)` for each file in layout
   - Aggregate all locations
   - Return complete array

3. Unit tests:
   - Test: references in current file only
   - Test: references in other files
   - Test: same symbol name in multiple files → all references shown

**Dependencies:** Task 1.1 (Filepath), existing pattern from Task 3.1

---

## Phase 6: Integration & Testing

### Task 6.1: E2E testing in playground

**Changes:**

1. Create test scenario in playground:
   - Multiple `.dbml` files open
   - Cross-file symbol completion works
   - Definition/references navigate between files
   - Use statements auto-inserted correctly

2. Manual testing checklist:
   - [ ] Type in file A, get suggestions from file B
   - [ ] Completion includes file hint (e.g., "from ./common.dbml")
   - [ ] Select cross-file completion → use statement inserted
   - [ ] Click definition → navigates to file B (if symbol defined there)
   - [ ] Find references → shows matches from all files
   - [ ] URI paths work (if integrated with IDE)

3. Test edge cases:
   - Same symbol name in multiple files → all shown
   - Symbol exists locally and in other files → local takes precedence
   - Circular use dependencies → work correctly
   - Malformed use statements → gracefully handled

**Dependencies:** Tasks 3.1, 4.1, 5.1 (all language services)

---

## Phase 7: Documentation & Cleanup

### Task 7.1: Update docs and examples

**Changes:**

1. Update `CLAUDE.md` if needed (reference new multi-file capability)
2. Add code comments to new helper methods
3. Update service types/interfaces docs
4. Document new `Filepath.fromUri()` API
5. Clean up any debugging logs

**Dependencies:** All phases

---

## Implementation Order (Sequential)

1. **Task 1.1** → Filepath URI support (foundation, no blockers)
2. **Task 2.1** → UseStatementMerger utility (no blockers)
3. **Task 3.1** → Suggestions provider (mid-impact, highest UX value)
4. **Task 4.1** → Definition provider (depends on patterns from 3.1)
5. **Task 5.1** → References provider (depends on patterns from 3.1)
6. **Task 6.1** → E2E testing (validates all providers)
7. **Task 7.1** → Documentation (final cleanup)

---

## Key Decisions & Rationale

### Why Suggestions first?
- Highest user-visible impact
- Requires most complex UX (merging use statements)
- Establishes pattern for other providers

### Why UseStatementMerger before Suggestions?
- Suggestions need it for on-selection behavior
- Can be tested independently
- Reusable for other features

### Why Filepath URI support first?
- Foundational; may be needed by all providers
- Small, focused task; quick to validate
- IDE integrations depend on it

### Layout Search Pattern
- Same pattern across all three providers (DRY)
- Each provider slightly customizes (completion hints, definition returns, etc.)
- Consider extracting to shared utility later if code duplication grows

---

## File Changes Summary

| File | Change Type | Task |
|------|-------------|------|
| `src/core/types/filepath.ts` | Add methods | 1.1 |
| `src/services/useStatementMerger.ts` | New file | 2.1 |
| `src/services/suggestions/provider.ts` | Update | 3.1 |
| `src/services/definition/provider.ts` | Update | 4.1 |
| `src/services/references/provider.ts` | Update | 5.1 |
| Tests | Add/Update | All |

---

## Success Metrics

- [x] Design approved
- [ ] All 7 tasks completed
- [ ] E2E testing passes
- [ ] No regressions in existing services
- [ ] Playground demo working with multi-file setup
