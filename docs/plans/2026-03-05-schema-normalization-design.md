# Schema Name Normalization in DiagramView and TableGroup

**Date:** 2026-03-05

## Problem

`Tables: [documents]` and `Tables: [public.documents]` produce different `schemaName` values when parsed, causing consumers to fail to match them against tables declared without an explicit schema (e.g., `Table documents { id int }`).

Root cause: the interpreters store `""` (empty string) or `"public"` for schema, while table declarations store `null` for the default schema. These never match.

## Canonical Rule

- `null` = public/default schema (no explicit schema specified, or `public` was specified)
- non-null string = explicit non-default schema

`public` is the `DEFAULT_SCHEMA_NAME` constant and must normalize to `null`.

## Fix (Approach A: Normalize at parse time)

### Files Changed

1. **`packages/dbml-parse/src/core/interpreter/elementInterpreter/diagramView.ts`**
   - `interpretCategoryList`: normalize `schemaName || ''` → `null` for empty/public
   - `interpretTableList`: normalize `fragments.join('.')` → `null` for empty/public
   - `interpretSingleItem`: use `null` instead of `''`

2. **`packages/dbml-parse/src/core/interpreter/elementInterpreter/tableGroup.ts`**
   - `interpretFields`: normalize `fragments.join('.')` → `null` for empty/public

3. **`packages/dbml-parse/src/core/interpreter/types.ts`**
   - `DiagramView.visibleEntities.tables`: change `schemaName: string` → `schemaName: string | null`

4. **Tests** — update expectations from `schemaName: ''` → `schemaName: null`

## Normalization Helper

```typescript
function normalizeSchemaName(raw: string): string | null {
  return (!raw || raw === DEFAULT_SCHEMA_NAME) ? null : raw;
}
```
