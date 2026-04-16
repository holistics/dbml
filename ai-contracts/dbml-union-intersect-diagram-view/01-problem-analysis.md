---
ai_summary: "DiagramView wildcard (*) in one Trinity dim gets ignored when sibling dims have explicit values — filterNormalizedModel treats [] as 'no filter' instead of 'show all'"
ai_warnings:
  - "Two changes needed: (1) dbml parser must always use union semantics and output concrete lists for wildcards, (2) syncDiagramView must not emit * when user has specific filters"
ai_generated_at: "2026-04-15"
mode: "refactor"
attached_repos:
  - dbml
  - dbx-utils
---

# Root Cause Analysis: DiagramView Wildcard Ignored When Sibling Dims Have Explicit Values

## Current Behavior

When a DiagramView block uses `*` (wildcard) in one Trinity dimension alongside explicit values in other dimensions, the wildcard dimension is silently ignored:

```dbml
DiagramView "MyView" {
  Tables: users, orders
  TableGroups: *
  Schemas: sales
}
```

**Result**: Shows `users`, `orders`, and all tables in schema `sales` — but **TableGroups are completely ignored**. No defined table groups are shown.

## Expected Behavior

Each Trinity dimension should independently contribute to the visible set (union/OR semantics):
- `Tables: users, orders` → show users, orders
- `TableGroups: *` → show ALL defined table groups (and their member tables)
- `Schemas: sales` → show ALL tables in schema `sales`
- **Result**: union of all three — users, orders, all tables in schema sales, plus all defined table groups

## Root Cause

The bug spans two layers — the **dbml parser** and the **filterNormalizedModel** utility in dbx-utils.

### Layer 1: `filterNormalizedModel.ts` (dbx-utils)

The `hasTableGroupFilters` check (line 128):
```typescript
const hasTableGroupFilters = tableGroupFilters !== null && tableGroupFilters !== undefined && !isEmpty(tableGroupFilters);
```

- `[]` (empty array) → `hasTableGroupFilters = false` (because `isEmpty([])` is `true`)
- But `[]` is documented as "SHOW ALL" (line 103): "`[]` (empty array) = SHOW ALL items of that type"
- The OR logic (line 275) only considers a dimension if `has*Filters` is `true`:
  ```typescript
  const isTableIncluded = isTableInTableFilter || isTableInGroupFilter || isTableInSchemaFilter;
  ```
  Since `hasTableGroupFilters = false`, `isTableInGroupFilter` is always `false`.

**Same issue applies to `hasTableFilters` and `hasSchemaFilters`** — empty arrays mean "show all" but are treated as "inactive filter".

### Layer 2: `expandDiagramViewWildcards` (dbml)

When `TableGroups: *` is combined with other Trinity dims:
1. `DiagramViewInterpreter` sets `tableGroups = []` and tracks it as a wildcard in `diagramViewWildcards`
2. `expandDiagramViewWildcards` checks (line 84): `otherTrinitySet = explicitlySet.has('tables') || explicitlySet.has('schemas')`
3. When other dims ARE set, it **refuses to expand** the wildcard — keeping `tableGroups = []`
4. This `[]` then hits `filterNormalizedModel` where it's treated as "no filter" → table groups ignored

### Layer 3: `syncDiagramView.ts` — generates `*` unnecessarily

`generateDiagramViewBlock` (line 91-93):
```typescript
} else if (visibleEntities.tables.length === 0) {
  lines.push('  Tables { * }');
}
```

When the frontend passes `tables: []` (meaning "user didn't filter tables"), `syncDiagramView` emits `Tables { * }`. This creates a block with `*` even when the user only intended to filter by schemas or table groups.

### The Full Bug Chain

1. User creates a view with `Tables: [users, orders]`, `Schemas: [sales]`, `TableGroups: []` (untouched)
2. `syncDiagramView` generates: `Tables { users, orders }` + `TableGroups { * }` + `Schemas { sales }` (because `tableGroups: []` → emits `*`)
3. Parser sets `tableGroups = []`, tracks as wildcard, but `expandDiagramViewWildcards` won't expand it (other Trinity dims are set)
4. `filterNormalizedModel` receives `tableGroups = []`, `hasTableGroupFilters = false` → table groups ignored
5. Wrong result: no table groups shown

## Affected Code

| File | Repo | Issue |
|------|------|-------|
| `packages/dbml-parse/src/core/interpreter/elementInterpreter/diagramView.ts` | dbml | Wildcard `[]` not expanded to concrete list when sibling dims are set |
| `packages/dbml-parse/src/core/interpreter/interpreter.ts:expandDiagramViewWildcards` | dbml | Only expands tableGroups wildcard when it's the ONLY Trinity dim |
| `packages/dbml-parse/src/compiler/queries/transform/syncDiagramView.ts:generateDiagramViewBlock` | dbml | Emits `*` when user didn't filter a dimension (empty array) |
| `src/filterNormalizedModel.ts` | dbx-utils | `has*Filters` treats `[]` as "no filter" instead of "show all" |

## Two Required Changes

### Change 1: Parser always uses union rules (dbml)

The parser should expand `*` wildcards to concrete lists **unconditionally** — regardless of whether sibling Trinity dims are set. This means:
- `Tables: *` → expand to all table names (from `env.tables`)
- `TableGroups: *` → expand to all table group names (from `env.tableGroups`)
- `Schemas: *` → expand to all schema names (from `env.schemas`)

After expansion, `filterNormalizedModel` receives concrete non-empty arrays and the `has*Filters` checks work correctly.

**Key concern**: The output must remain compatible with `dbdiagram-frontend`. Currently the frontend uses `getFilterConfig()` which treats `[]` as "show all". After the change, `*` will be expanded to concrete lists, so the frontend will receive specific items instead of `[]`. Need to verify this doesn't break:
- View switching (loading view filter from parsed data)
- Default view filter logic
- Table rename propagation across views

### Change 2: `syncDiagramView` should not emit `*` (dbml)

When generating DBML from UI operations, `generateDiagramViewBlock` should **omit** dimensions the user didn't filter (where the array is empty = "show all"). This prevents the parser from ever seeing `*` for cases where the user only filtered some dimensions.

```typescript
// Before: empty array → emits "Tables { * }"
// After: empty array → omits the Tables block entirely
if (visibleEntities?.tables !== undefined) {
  if (visibleEntities.tables === null) {
    // Hide all - don't add block
  } else if (visibleEntities.tables.length === 0) {
    // Show all - omit block (was: "Tables { * }")
  } else {
    // Specific items
  }
}
```

This is safe because the "Trinity omit rule" already handles omitted dims:
- If any Trinity dim IS set → omitted dims get `[]` (show all)
- If NO Trinity dim is set → everything stays `null` (handled by filterNormalizedModel)

## Reproduction Steps

1. Create a diagram with multiple tables, table groups, and schemas
2. Write DBML:
   ```dbml
   DiagramView "Test" {
     Tables { users, orders }
     TableGroups { * }
     Schemas { sales }
   }
   ```
3. Parse and render the diagram
4. Observe: table groups are not shown
5. Expected: all defined table groups should be visible

## Open Questions

- [ ] Should `expandDiagramViewWildcards` be expanded to handle ALL Trinity dims (tables, schemas, notes) or just tableGroups?
- [ ] Does the dbx-utils `filterNormalizedModel` need changes, or is the dbml-only fix (always expanding wildcards to concrete lists) sufficient?
- [ ] Are there callers of `syncDiagramView` that depend on `*` being emitted for "show all" dimensions?
