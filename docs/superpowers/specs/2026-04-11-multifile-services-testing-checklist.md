# Multi-File Language Services: Testing Checklist

## E2E Testing Scenarios

### Scenario 1: Cross-File Symbol Completion
- [ ] Open two `.dbml` files in the playground (e.g., `main.dbml` and `common.dbml`)
- [ ] Type a symbol name from `common.dbml` in `main.dbml`
- [ ] Verify suggestions appear with file hint (e.g., "from common.dbml")
- [ ] Select the suggestion
- [ ] Verify `use { symbol } from './common'` is auto-inserted at top of file

### Scenario 2: Definition Navigation (Multi-File)
- [ ] Click on a symbol defined in another file
- [ ] Verify "Go to Definition" navigates to the correct file
- [ ] Verify cursor lands on the symbol definition line

### Scenario 3: Find References (Cross-File)
- [ ] Right-click on a symbol used in multiple files
- [ ] Select "Find All References"
- [ ] Verify all references from all files are listed
- [ ] Verify each reference shows the correct file path

### Scenario 4: Use Statement Merging
- [ ] Add a symbol from `common.dbml` to an existing `use from './common'` statement
- [ ] Verify new symbol is appended to the existing import list (not creating a duplicate `use`)
- [ ] Verify formatting is preserved

### Scenario 5: Symbol Disambiguation
- [ ] Create same-named symbol in multiple files (e.g., `users` Table in both `schema1.dbml` and `schema2.dbml`)
- [ ] Type the symbol name in the current file
- [ ] Verify suggestions show both, with distinct file hints
- [ ] Select one and verify correct file's symbol is used

### Scenario 6: URI Path Handling
- [ ] Verify `Filepath.fromUri('file:///path/to/file.dbml')` converts correctly
- [ ] Verify `filepath.toUri()` serializes back to valid URI format
- [ ] Test on both Windows and Unix-style paths

## Manual Testing Checklist

- [ ] Single-file projects still work (no regression)
- [ ] Multi-file projects with circular `use` statements work
- [ ] Typos in cross-file symbols show appropriate errors
- [ ] Performance is acceptable with 5+ files open
- [ ] No memory leaks when opening/closing files repeatedly

## Known Limitations

- Cross-file suggestions currently show after local suggestions (zzz_ prefix)
- Layout search requires compiler.layout to be populated
- Symbol deduplication works but same-name symbols in multiple files all appear

## Future Improvements

- Fuzzy match for cross-file symbol search
- Smart sorting (prioritize symbols from imported files)
- Incremental layout loading for large projects
- Cache invalidation optimization per file
