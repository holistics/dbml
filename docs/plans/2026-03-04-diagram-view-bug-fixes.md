# DiagramView Bug Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three bugs in DiagramView: (1) empty body showing all, (2) schema-qualified names in brackets, (3) default schema matching

**Architecture:**
- Frontend: Add flag to indicate "explicit empty" to prevent getFilterConfig from converting to "show all"
- Parser: Improve list expression parsing to handle schema-qualified names with dots
- Validator: Add validation for table references with default schema matching

**Tech Stack:** TypeScript, DBML Parser, Vue.js frontend

---

## Task 1: Fix Empty Body Shows All (Frontend)

**Files:**
- Modify: `/Users/huyphung/workspace/dbx/dbdiagram-frontend/src/utils/dbmlDiagramView.ts`

**Problem:**
- DBML returns `visibleEntities: { tables: [], schemas: [], tableGroups: [], stickyNotes: [] }` for empty body
- `lodash.isEmpty({ tables: [], ... })` returns `true` because all arrays are empty
- This causes `getFilterConfig()` to return default `{ tables: [], ... }` which shows ALL entities

**Solution:**
Add a special marker to indicate "explicit empty" - convert empty arrays to `null` with a special flag, OR modify the return to use a different structure that doesn't trigger `isEmpty`.

The simplest fix: In `dbmlDiagramViewToFilterConfig()`, when ALL categories are empty arrays `[]`, convert them to `null` (which signals "show all") BUT also add an explicit `_showNothing: true` flag that the frontend can check.

Actually, a simpler approach: Just return the structure as-is, but in the chart store, check for explicit empty before calling `getFilterConfig()`.

Wait - the simplest fix is in `helpers.ts` - change `getFilterConfig` to NOT treat `{ tables: [], ... }` as empty. Check if ANY array has content, not if ALL arrays are empty.

**Step 1: Read current getFilterConfig**

```bash
cat /Users/huyphung/workspace/dbx/dbdiagram-frontend/src/utils/helpers.ts | grep -A10 "getFilterConfig"
```

**Step 2: Modify to check for explicit empty**

Change from:
```typescript
export const getFilterConfig = (filterConfig?: FilterConfig | null): FilterConfig => {
  return isEmpty(filterConfig)
    ? { tables: [], schemas: [], tableGroups: [], stickyNotes: [] }
    : filterConfig;
};
```

To check if filterConfig has explicitly set values:
```typescript
export const getFilterConfig = (filterConfig?: FilterConfig | null): FilterConfig => {
  // If null/undefined, return default (show all)
  if (!filterConfig) {
    return { tables: [], schemas: [], tableGroups: [], stickyNotes: [] };
  }

  // Check if any category has content - if so, use as-is
  const hasContent = (filterConfig.tables?.length > 0) ||
                    (filterConfig.schemas?.length > 0) ||
                    (filterConfig.tableGroups?.length > 0) ||
                    (filterConfig.stickyNotes?.length > 0);

  // If has content or ALL are empty arrays (explicitly set to empty), return as-is
  // This preserves "show nothing" when user sets Tables: []
  return filterConfig;
};
```

Actually wait - that won't work. The issue is that `isEmpty({ tables: [], schemas: [], ... })` is true in lodash. We need to change the check.

**Step 3: Fix getFilterConfig**

```typescript
export const getFilterConfig = (filterConfig?: FilterConfig | null): FilterConfig => {
  // If null/undefined, return default (show all)
  if (!filterConfig) {
    return { tables: [], schemas: [], tableGroups: [], stickyNotes: [] };
  }

  // If filterConfig is an object with any array having content, use as-is
  // Otherwise return default
  const hasContent = (filterConfig.tables && filterConfig.tables.length > 0) ||
                    (filterConfig.schemas && filterConfig.schemas.length > 0) ||
                    (filterConfig.tableGroups && filterConfig.tableGroups.length > 0) ||
                    (filterConfig.stickyNotes && filterConfig.stickyNotes.length > 0);

  return hasContent ? filterConfig : { tables: [], schemas: [], tableGroups: [], stickyNotes: [] };
};
```

This way:
- `{ tables: [a], schemas: [], ... }` -> returns as-is (show specific tables)
- `{ tables: [], schemas: [], ... }` -> returns default { tables: [], ... } (show all!)
- `null` -> returns default { tables: [], ... } (show all)

Wait - this doesn't fix it! The issue is that when DBML sends `{ tables: [], schemas: [], ... }`, we want to show NOTHING, not all.

The REAL fix: The DBML parser should NOT output empty arrays for empty body. Instead, it should output `null` for all categories. Then in the frontend, we need a way to distinguish:
- `null` = show all (default)
- `[]` = show nothing (explicitly empty)

But `getFilterConfig` treats both as "show all".

**Solution: Add explicit flag in FilterConfig type**

Modify the FilterConfig type to include an explicit flag, OR modify dbmlDiagramViewToFilterConfig to return a different structure.

Actually, the simplest fix: Don't change getFilterConfig. Instead, in dbmlDiagramViewToFilterConfig, when ALL categories are empty arrays, DON'T pass through - instead return `undefined` or `null` which will trigger the default "show all" behavior.

Wait - but we want "show nothing", not "show all"!

OK the real fix: Change dbmlDiagramViewToFilterConfig to return a structure that includes all 4 categories with values, but when all are empty, add a special marker `_explicitEmpty: true`. Then modify getFilterConfig to check for this marker.

Or simpler: Change the DBML interpreter to output `null` instead of `[]` for empty body, and change the frontend to interpret `null` as "show nothing" for DiagramView specifically.

Let me re-read the user's requirement: "DiagramView view_name {} is showing all entities, it should show nothing"

So the expected behavior is:
- `DiagramView name {}` -> shows NOTHING (empty canvas)
- `DiagramView name` (no body) -> shows ALL

The current implementation outputs `[]` for empty body. We need to either:
1. Change parser to output something else (like a marker)
2. Or change frontend to interpret `[]` as "show nothing" for DiagramView specifically

**Step 3: Implement the fix**

Option A: Modify helpers.ts getFilterConfig to accept a parameter indicating explicit empty

Option B: Modify dbmlDiagramView.ts to return a wrapped type with explicit flag

Let's go with Option A - add parameter:

```typescript
export const getFilterConfig = (
  filterConfig?: FilterConfig | null,
  options?: { treatEmptyAsAll?: boolean }
): FilterConfig => {
  const treatEmptyAsAll = options?.treatEmptyAsAll ?? true;

  if (!filterConfig) {
    return { tables: [], schemas: [], tableGroups: [], stickyNotes: [] };
  }

  // Check if any category has content
  const hasContent = (filterConfig.tables && filterConfig.tables.length > 0) ||
                    (filterConfig.schemas && filterConfig.schemas.length > 0) ||
                    (filterConfig.tableGroups && filterConfig.tableGroups.length > 0) ||
                    (filterConfig.stickyNotes && filterConfig.stickyNotes.length > 0);

  if (hasContent) {
    return filterConfig;
  }

  // No content - decide based on treatEmptyAsAll
  if (treatEmptyAsAll) {
    return { tables: [], schemas: [], tableGroups: [], stickyNotes: [] };
  }

  // Return as-is (will show nothing)
  return filterConfig;
};
```

Then in DiagramView conversion:
```typescript
export function dbmlDiagramViewToFilterConfig(view: DbmlDiagramView): FilterConfig {
  const config = {
    tables: view.visibleEntities.tables,
    schemas: view.visibleEntities.schemas,
    tableGroups: view.visibleEntities.tableGroups,
    stickyNotes: view.visibleEntities.stickyNotes,
  };

  // For DiagramView: empty arrays mean "show nothing", not "show all"
  // Pass treatEmptyAsAll: false to preserve empty arrays
  return getFilterConfig(config, { treatEmptyAsAll: false });
}
```

**Step 4: Test**

Run frontend tests to verify:
```bash
cd /Users/huyphung/workspace/dbx/dbdiagram-frontend && yarn test:unit
```

---

## Task 2: Fix Schema-Qualified Names in Brackets

**Files:**
- Modify: `/Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/src/core/interpreter/elementInterpreter/diagramView.ts`
- Test: Add test case for schema-qualified names

**Problem:**
`Tables: [public.table1, public.table2]` causes syntax error because dots inside `[]` are not parsed correctly.

**Solution:**
The parser should already handle this via `extractListItems` method which joins identifiers with `.`. The issue might be in how the list is parsed. Let me check the current implementation:

The `extractListItems` method (lines 345-374) handles:
- `IdentiferStreamNode` - joins identifiers with `.`
- `PrimaryExpressionNode` with `VariableNode`

For `[public.table1, public.table2]`, each item should be an `IdentiferStreamNode` with identifiers `['public', 'table1']`.

Let me trace through to see if this is working. First, add a test case:

**Step 1: Add test case**

```dbml
Table public.users {
  id int [pk]
}

Table public.posts {
  id int [pk]
}

DiagramView "Schema Tables" {
  Tables: [public.users, public.posts]
}
```

**Step 2: Run parser to check**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse && npx vitest run -t "diagram_view_new_syntax" 2>&1 | tail -20
```

If it fails, investigate `extractListItems` method.

---

## Task 3: Fix Default Schema Matching

**Files:**
- Modify: `/Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/src/core/analyzer/validator/elementValidators/diagramView.ts`

**Problem:**
Table defined as `Table public.documents {}` but referenced as `documents` in DiagramView doesn't match.

**Solution:**
In the validator (or interpreter), when matching table references:
- If user references `table_name` (no schema), check if there's a table with that name in the default schema
- The default schema is typically `public` unless specified otherwise

We need to:
1. Get the default schema from the program
2. When validating references, if no schema is specified, also check the default schema

**Step 1: Read current validator**

The current validator only checks for duplicate names. We need to add validation for table references.

**Step 2: Add validation logic**

Add a method to validate table references in DiagramView:

```typescript
// In DiagramViewValidator
validate (): CompileError[] {
  const errors: CompileError[] = [];

  // ... existing duplicate name check ...

  // Add: Validate table references
  errors.push(...this.validateTableReferences());
  errors.push(...this.validateNoteReferences());
  errors.push(...this.validateTableGroupReferences());

  return errors;
}

private validateTableReferences (): CompileError[] {
  const errors: CompileError[] = [];

  // Get tables from visibleEntities
  // For each table reference, check if it exists
  // If not found with exact match, check if it exists in default schema

  // Get default schema from program
  const defaultSchema = this.getDefaultSchema();

  // For each table reference without schema, also check default schema
  // ...

  return errors;
}
```

**Step 3: Test**

Add validator test case:

```dbml
Table public.users {
  id int [pk]
}

DiagramView "Ref Without Schema" {
  Tables: [users]  // Should match public.users
}
```

---

## Summary of Changes

| Task | File | Change |
|------|------|--------|
| 1 | dbdiagram-frontend/src/utils/helpers.ts | Add `treatEmptyAsAll` option to getFilterConfig |
| 1 | dbdiagram-frontend/src/utils/dbmlDiagramView.ts | Pass option to preserve empty arrays |
| 2 | dbml-parse tests | Add test for schema-qualified names |
| 3 | dbml-parse validator | Add validation with default schema matching |

---

**Plan complete and saved to `docs/plans/2026-03-04-diagram-view-bug-fixes.md`.**

Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
