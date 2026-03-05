# DiagramView: Validation, Binding, and Formatting

**Date:** 2026-03-05

## Problem Summary

Three independent issues with DiagramView's `Tables: []`, `TableGroups: []`, `Schemas: []` colon-syntax support:

1. **Validator** does not validate names inside colon-syntax lists
2. **Binder** does not bind table references in colon-syntax lists, so `renameTable` misses them
3. **Generator** always uses inline syntax regardless of list length

---

## Issue 1: Validation of Colon-Syntax Lists

### Root Cause

`DiagramViewValidator` returns early when it encounters a `FunctionApplicationNode` body (which is what `Tables: [...]` produces inside a block). Only the old block syntax `Tables { users }` is validated.

### Fix

In `elementValidators/diagramView.ts`, extend each category validator (`validateTables`, `validateSchemas`, `validateTableGroups`) to handle the colon-syntax path:

- Detect when `element.body` is a `FunctionApplicationNode` whose `callee` is a `ListExpressionNode`
- Extract names from the list items (same logic as interpreter's `extractListItems`)
- Run the same symbol existence checks already used for block syntax
- Emit `UNKNOWN_SYMBOL` errors for names that don't resolve

Scope: `Tables`, `TableGroups`, `Schemas` inside `DiagramView { ... }` blocks only.

---

## Issue 2: Binder Fix for renameTable Support

### Root Cause

`DiagramViewBinder.bindBody` only processes `BlockExpressionNode` sub-elements. When a sub-element uses colon syntax (`Tables: [users, orders]`), its body is a `FunctionApplicationNode` — the binder returns early, creating no symbol bindings. `renameTable` relies on symbol references, so it never finds these nodes.

### Fix

In `elementBinder/diagramView.ts`, extend `bindBody` to handle the colon-syntax case **only inside the DiagramView block** (not the top-level `DiagramView name: [...]` form):

- When iterating `bodyElements`, detect `ElementDeclarationNode` where `element.body instanceof FunctionApplicationNode` and `element.body.callee instanceof ListExpressionNode`
- For `type === 'tables'`: extract each list item, call `scanNonListNodeForBinding` on each, then call `lookupAndBindInScope` — same as `bindTableReferences` does for block syntax
- For `type === 'notes'` / `type === 'sticky_notes'` / `type === 'tablegroups'` / `type === 'schemas'`: no binding needed (rename doesn't apply to these)

Once bindings exist, `renameTable` automatically follows them with no changes needed there.

---

## Issue 3: Multi-line Format When > 3 Entities

### Rule

In `generateDiagramViewDbml` (compiler/queries/transform/diagramView.ts):

- **≤ 3 items** → inline: `Tables: [a, b, c]`
- **> 3 items** → multi-line with trailing comma:
  ```
  Tables: [
    a,
    b,
    c,
    d,
  ]
  ```

Applies to all four categories: `Tables`, `Notes`, `TableGroups`, `Schemas`.

### Implementation

Extract a helper:

```typescript
function formatEntityList(items: string[], indent = '  '): string {
  if (items.length <= 3) {
    return `[${items.join(', ')}]`;
  }
  const lines = items.map(item => `${indent}  ${item},`);
  return `[\n${lines.join('\n')}\n${indent}]`;
}
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/core/analyzer/validator/elementValidators/diagramView.ts` | Extend validators to handle colon-syntax lists |
| `src/core/analyzer/binder/elementBinder/diagramView.ts` | Bind table refs in colon-syntax `Tables: [...]` inside block |
| `src/compiler/queries/transform/diagramView.ts` | Multi-line format for > 3 items with trailing comma |

## Testing

- Validator: add tests for unknown table/schema/tableGroup names in colon-syntax lists
- Binder/renameTable: add tests for `renameTable` updating `Tables: [users]` inside DiagramView block
- Generator: add tests asserting inline for ≤ 3, multi-line for > 3
