# DiagramView Validation, Binding, and Formatting Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three independent issues with DiagramView colon-syntax (`Tables: [...]`): missing validation, missing symbol binding (breaks renameTable), and always-inline list formatting.

**Architecture:** Three independent changes — extend the validator to cover colon-syntax lists, extend the binder to create symbol bindings for colon-syntax table lists inside DiagramView blocks, and add a multi-line formatter to the DBML generator.

**Tech Stack:** TypeScript, Vitest, dbml-parse package (`packages/dbml-parse`)

---

## Task 1: Multi-line list formatting in `generateDiagramViewDbml`

**Files:**
- Modify: `packages/dbml-parse/src/compiler/queries/transform/diagramView.ts`
- Test: `packages/dbml-parse/__tests__/examples/compiler/diagramViewTransform.test.ts`

### Step 1: Write the failing tests

Add to the `describe('[example] DiagramView transformation APIs')` block in `diagramViewTransform.test.ts`:

```typescript
describe('multi-line formatting', () => {
  test('should use inline format for 3 or fewer tables', () => {
    const result = createDiagramView('v', {
      tables: [
        { name: 'a', schemaName: 'public' },
        { name: 'b', schemaName: 'public' },
        { name: 'c', schemaName: 'public' },
      ],
      schemas: null,
      tableGroups: null,
      stickyNotes: null,
    }, '');
    expect(result).toContain('Tables: [a, b, c]');
  });

  test('should use multi-line format for more than 3 tables', () => {
    const result = createDiagramView('v', {
      tables: [
        { name: 'a', schemaName: 'public' },
        { name: 'b', schemaName: 'public' },
        { name: 'c', schemaName: 'public' },
        { name: 'd', schemaName: 'public' },
      ],
      schemas: null,
      tableGroups: null,
      stickyNotes: null,
    }, '');
    expect(result).toContain('Tables: [\n    a,\n    b,\n    c,\n    d,\n  ]');
  });

  test('should use multi-line format for more than 3 schemas', () => {
    const result = createDiagramView('v', {
      tables: null,
      schemas: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
      tableGroups: null,
      stickyNotes: null,
    }, '');
    expect(result).toContain('Schemas: [\n    a,\n    b,\n    c,\n    d,\n  ]');
  });

  test('should use multi-line format for more than 3 tableGroups', () => {
    const result = createDiagramView('v', {
      tables: null,
      schemas: null,
      tableGroups: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
      stickyNotes: null,
    }, '');
    expect(result).toContain('TableGroups: [\n    a,\n    b,\n    c,\n    d,\n  ]');
  });

  test('should use multi-line format for more than 3 notes', () => {
    const result = createDiagramView('v', {
      tables: null,
      schemas: null,
      tableGroups: null,
      stickyNotes: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
    }, '');
    expect(result).toContain('Notes: [\n    a,\n    b,\n    c,\n    d,\n  ]');
  });

  test('should include schema prefix in multi-line tables when schema is not public', () => {
    const result = createDiagramView('v', {
      tables: [
        { name: 'a', schemaName: 'core' },
        { name: 'b', schemaName: 'core' },
        { name: 'c', schemaName: 'core' },
        { name: 'd', schemaName: 'core' },
      ],
      schemas: null,
      tableGroups: null,
      stickyNotes: null,
    }, '');
    expect(result).toContain('Tables: [\n    core.a,\n    core.b,\n    core.c,\n    core.d,\n  ]');
  });
});
```

### Step 2: Run tests to confirm they fail

```bash
cd /Users/huyphung/workspace/dbx/dbml
npx vitest run packages/dbml-parse/__tests__/examples/compiler/diagramViewTransform.test.ts
```

Expected: failures on the multi-line format assertions.

### Step 3: Add `formatEntityList` helper and update `generateDiagramViewDbml`

In `packages/dbml-parse/src/compiler/queries/transform/diagramView.ts`, add the helper function after `quoteNameIfNeeded` (after line 25):

```typescript
function formatEntityList(items: string[], indent = '  '): string {
  if (items.length <= 3) {
    return `[${items.join(', ')}]`;
  }
  const lines = items.map(item => `${indent}  ${item},`);
  return `[\n${lines.join('\n')}\n${indent}]`;
}
```

Then in `generateDiagramViewDbml`, replace the four inline push calls:

**Tables** (replace lines ~37-38):
```typescript
// Before:
lines.push(`  Tables: [${tableRefs.join(', ')}]`);
// After:
lines.push(`  Tables: ${formatEntityList(tableRefs)}`);
```

**Notes** (replace lines ~48):
```typescript
// Before:
lines.push(`  Notes: [${noteRefs.join(', ')}]`);
// After:
lines.push(`  Notes: ${formatEntityList(noteRefs)}`);
```

**TableGroups** (replace lines ~59):
```typescript
// Before:
lines.push(`  TableGroups: [${groupRefs.join(', ')}]`);
// After:
lines.push(`  TableGroups: ${formatEntityList(groupRefs)}`);
```

**Schemas** (replace lines ~69):
```typescript
// Before:
lines.push(`  Schemas: [${schemaRefs.join(', ')}]`);
// After:
lines.push(`  Schemas: ${formatEntityList(schemaRefs)}`);
```

Also update the `schemaName` filter in the tables map — `public` schema should not be prefixed:
```typescript
const tableRefs = filterConfig.tables.map(t => {
  const tableRef = (t.schemaName && t.schemaName !== DEFAULT_SCHEMA_NAME)
    ? `${t.schemaName}.${t.name}`
    : t.name;
  return tableRef;
});
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run packages/dbml-parse/__tests__/examples/compiler/diagramViewTransform.test.ts
```

Expected: all pass.

### Step 5: Update snapshots if needed

```bash
cd packages/dbml-parse && npx vitest run -u
```

### Step 6: Commit

```bash
git add packages/dbml-parse/src/compiler/queries/transform/diagramView.ts \
        packages/dbml-parse/__tests__/examples/compiler/diagramViewTransform.test.ts
git commit -m "feat: use multi-line format for DiagramView lists with > 3 items"
```

---

## Task 2: Bind colon-syntax table references in DiagramView blocks

**Files:**
- Modify: `packages/dbml-parse/src/core/analyzer/binder/elementBinder/diagramView.ts`
- Test: `packages/dbml-parse/__tests__/examples/compiler/renameTable.test.ts`

### Step 1: Write the failing tests

In `renameTable.test.ts`, inside the existing `describe('diagramView', ...)` block, add:

```typescript
test('should rename table in colon-syntax Tables: [users] inside DiagramView block', () => {
  const input = `
Table users {
  id int [pk]
}

Table posts {
  id int [pk]
}

DiagramView my_view {
  Tables: [users, posts]
}
`;
  const result = renameTable('users', 'customers', input);
  expect(result).toContain('Table customers');
  expect(result).not.toContain('Table users');
  // The reference inside Tables: [...] must also be updated
  expect(result).toMatch(/Tables:\s*\[customers/);
  expect(result).toContain('posts');
});

test('should rename schema-qualified table in colon-syntax Tables: [core.users]', () => {
  const input = `
Table core.users {
  id int [pk]
}

DiagramView my_view {
  Tables: [core.users]
}
`;
  const result = renameTable('core.users', 'core.customers', input);
  expect(result).toContain('core.customers');
  expect(result).not.toContain('core.users');
});
```

### Step 2: Run tests to confirm they fail

```bash
npx vitest run packages/dbml-parse/__tests__/examples/compiler/renameTable.test.ts -t "colon-syntax"
```

Expected: failures — the table reference inside `Tables: [...]` is not renamed.

### Step 3: Extend `DiagramViewBinder.bindBody` for colon syntax

In `packages/dbml-parse/src/core/analyzer/binder/elementBinder/diagramView.ts`, update the `bindBody` method.

The current loop (lines 38-61) only casts `element.body` as `BlockExpressionNode`. We need to also handle when `element.body instanceof FunctionApplicationNode` and its `callee instanceof ListExpressionNode`.

First add the missing import at the top:
```typescript
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode,
  ListExpressionNode, ProgramNode,
} from '@/core/parser/nodes';
```

Then in the `for` loop inside `bindBody`, change the `'tables'` case:

```typescript
case 'tables': {
  if (element.body instanceof FunctionApplicationNode
    && element.body.callee instanceof ListExpressionNode) {
    // Colon syntax: Tables: [users, posts]
    errors.push(...this.bindTableReferencesFromList(element.body.callee));
  } else {
    // Block syntax: tables { users \n posts }
    errors.push(...this.bindTableReferences(element.body as BlockExpressionNode | undefined));
  }
  break;
}
```

Then add the new `bindTableReferencesFromList` method (after `bindTableReferences`):

```typescript
private bindTableReferencesFromList(listNode: ListExpressionNode): CompileError[] {
  for (const item of listNode.elementList) {
    const bindees = scanNonListNodeForBinding(item);

    for (const bindee of bindees) {
      const tableBindee = bindee.variables.pop();
      if (!tableBindee) {
        continue;
      }
      const schemaBindees = bindee.variables;

      const bindPath: { node: any; kind: SymbolKind }[] = [
        ...schemaBindees.map((b: any) => ({ node: b, kind: SymbolKind.Schema })),
        { node: tableBindee, kind: SymbolKind.Table },
      ];

      try {
        lookupAndBindInScope(this.ast, bindPath);
      } catch (e) {
        // Ignore binding errors - table may not exist
      }
    }
  }

  return [];
}
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run packages/dbml-parse/__tests__/examples/compiler/renameTable.test.ts
```

Expected: all tests pass including the new colon-syntax tests.

### Step 5: Run all tests to check for regressions

```bash
cd packages/dbml-parse && npx vitest run
```

Expected: all pass (only the pre-existing pre-existing failures, if any).

### Step 6: Commit

```bash
git add packages/dbml-parse/src/core/analyzer/binder/elementBinder/diagramView.ts \
        packages/dbml-parse/__tests__/examples/compiler/renameTable.test.ts
git commit -m "fix: bind table references in colon-syntax Tables: [] inside DiagramView blocks"
```

---

## Task 3: Validate names in colon-syntax lists in DiagramViewValidator

**Files:**
- Modify: `packages/dbml-parse/src/core/analyzer/validator/elementValidators/diagramView.ts`
- Test: `packages/dbml-parse/__tests__/examples/validator/validator.test.ts`

### Step 1: Write the failing tests

In `validator.test.ts`, add a new `describe` block:

```typescript
import { compile } from '@tests/utils'; // or whatever the test utility import is

describe('[example] DiagramView validator - colon syntax', () => {
  test('should report error for unknown table in Tables: [...]', () => {
    const source = `
Table users { id int }

DiagramView my_view {
  Tables: [users, nonexistent]
}
`;
    const errors = compile(source).getErrors();
    expect(errors.some(e => e.message?.includes("nonexistent"))).toBe(true);
  });

  test('should not report error for valid table in Tables: [...]', () => {
    const source = `
Table users { id int }
Table posts { id int }

DiagramView my_view {
  Tables: [users, posts]
}
`;
    const errors = compile(source).getErrors();
    const validationErrors = errors.filter(e => e.message?.includes('does not exist'));
    expect(validationErrors).toHaveLength(0);
  });

  test('should report error for unknown schema-qualified table in Tables: [...]', () => {
    const source = `
Table public.users { id int }

DiagramView my_view {
  Tables: [public.users, core.nonexistent]
}
`;
    const errors = compile(source).getErrors();
    expect(errors.some(e => e.message?.includes('core'))).toBe(true);
  });

  test('should report error for unknown tableGroup in TableGroups: [...]', () => {
    const source = `
Table users { id int }
TableGroup g1 { users }

DiagramView my_view {
  TableGroups: [g1, nonexistent_group]
}
`;
    const errors = compile(source).getErrors();
    expect(errors.some(e => e.message?.includes('nonexistent_group'))).toBe(true);
  });

  test('should not report error for valid tableGroup in TableGroups: [...]', () => {
    const source = `
Table users { id int }
TableGroup g1 { users }

DiagramView my_view {
  TableGroups: [g1]
}
`;
    const errors = compile(source).getErrors();
    const validationErrors = errors.filter(e => e.message?.includes('does not exist'));
    expect(validationErrors).toHaveLength(0);
  });
});
```

Check the test utility import at the top of `validator.test.ts` to match the correct import style.

### Step 2: Run tests to confirm they fail

```bash
npx vitest run packages/dbml-parse/__tests__/examples/validator/validator.test.ts -t "colon syntax"
```

Expected: errors not reported for unknown names (no validation of colon syntax yet).

### Step 3: Extract a shared helper to get list items from colon-syntax body

In `diagramView.ts` validator, add a helper at the top of the class (or as a module-level function):

```typescript
/**
 * Given an ElementDeclarationNode whose body is colon-syntax (FunctionApplicationNode
 * with a ListExpressionNode callee), extracts each list item's callee SyntaxNode.
 * Returns [] if the body is not colon-list syntax.
 */
function extractColonListCallees(element: ElementDeclarationNode): SyntaxNode[] {
  if (!(element.body instanceof FunctionApplicationNode)) return [];
  const callee = element.body.callee;
  if (!(callee instanceof ListExpressionNode)) return [];
  // Each list item is an AttributeNode or expression; we need the raw node to destructure
  return callee.elementList;
}
```

You will also need to add `ListExpressionNode` and `AttributeNode` to the imports at the top of the validator file.

### Step 4: Extend `validateTableReferences` to handle colon syntax

The current method bails out at line ~81:
```typescript
if (!tablesBlock?.body || tablesBlock.body instanceof FunctionApplicationNode) {
  return errors;
}
```

Replace that early return with a branch that handles both paths:

```typescript
if (!tablesBlock?.body) {
  return errors;
}

// Colon syntax: Tables: [users, posts]
if (tablesBlock.body instanceof FunctionApplicationNode) {
  const listItems = extractColonListCallees(tablesBlock);
  return this.validateTableListItems(listItems, program);
}

// Block syntax: tables { users \n posts }
return this.validateTableBlockItems(tablesBlock.body, program);
```

Then rename the existing loop body into `validateTableBlockItems` (takes `BlockExpressionNode`) and add `validateTableListItems` (takes `SyntaxNode[]` — the raw list element nodes).

For `validateTableListItems`, each item in the list is typically an `AttributeNode` wrapping the table name expression, or an `InfixExpressionNode` for `schema.table`. Use `destructureComplexVariable` on the appropriate node (same as the interpreter's `extractListItems` logic) to get name fragments:

```typescript
private validateTableListItems(items: SyntaxNode[], program: ProgramNode): CompileError[] {
  const errors: CompileError[] = [];
  // Re-use same schema/table existence logic as block syntax
  // For each item, extract the name node and call the shared validate logic
  for (const item of items) {
    // item is an AttributeNode; the name is item.name (an IdentiferStreamNode or InfixExpressionNode)
    // Use destructureComplexVariable on the right sub-node to get fragments
    const nameNode = (item as any).name ?? item;
    const nameFragments = destructureComplexVariable(nameNode).unwrap_or([]);
    const tableName = nameFragments.pop();
    const schemaNames = nameFragments;
    if (!tableName) continue;
    errors.push(...this.validateSingleTableRef(tableName, schemaNames, nameNode, program));
  }
  return errors;
}
```

Extract the per-table validation logic from the existing block into `validateSingleTableRef(tableName, schemaNames, errorNode, program)` so both paths share it.

### Step 5: Extend `validateTableGroupReferences` to handle colon syntax

Apply the same pattern — when `tableGroupsBlock.body instanceof FunctionApplicationNode`, extract list items and validate each group name against `TableGroup:${name}` in the symbol table.

### Step 6: Run tests to confirm they pass

```bash
npx vitest run packages/dbml-parse/__tests__/examples/validator/validator.test.ts
```

Expected: all pass.

### Step 7: Run all tests for regressions

```bash
cd packages/dbml-parse && npx vitest run
```

Expected: all pass.

### Step 8: Commit

```bash
git add packages/dbml-parse/src/core/analyzer/validator/elementValidators/diagramView.ts \
        packages/dbml-parse/__tests__/examples/validator/validator.test.ts
git commit -m "fix: validate table and tableGroup names in DiagramView colon-syntax lists"
```
