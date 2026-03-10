# DiagramView Block Syntax Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current colon/list DiagramView syntax with a clean block syntax where `{*}` means "show all" and `*` alone means "show everything".

**Architecture:** All changes are in `@dbml/parse`. The interpreter, binder, validator, and transform modules each need colon-syntax paths removed and `{*}` / `*` detection added. After changing source files, rebuild `@dbml/parse` and verify `@dbml/core` tests pass.

**Tech Stack:** TypeScript, Vitest, `@dbml/parse` package at `/Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/`

---

## Agreed Syntax & Semantics

```dbml
// Show all tables (new "all" syntax)
DiagramView my_view {
  Tables: {*}
}

// Show specific items (block syntax — unchanged)
DiagramView my_view {
  Tables {
    users
    posts
    core.orders
  }
  Notes {
    reminder
  }
  TableGroups {
    e_commerce
  }
  Schemas {
    core
  }
}

// Show all everything — top-level * in body
DiagramView my_view {
  *
}

// Show nothing — empty category block
DiagramView my_view {
  Tables {}
}

// Show nothing for all — empty DiagramView body
DiagramView my_view {}
DiagramView my_view   // no body
```

| Syntax | rawDb value | Meaning |
|---|---|---|
| `Tables: {*}` | `null` | show all tables |
| `Tables { users }` | `[{name:'users', schemaName:null}]` | show specific |
| `Tables {}` | `[]` | show nothing |
| Category omitted | `[]` | show nothing |
| `DiagramView x { * }` | all categories `null` | show everything |
| `DiagramView x {}` | all categories `[]` | show nothing |
| `DiagramView x` (no body) | all categories `[]` | show nothing |

**Key semantic change from current code:**
- Current: no body → `null` (show all). New: no body → `[]` (show nothing)
- Current: `Tables: all` → `null`. Removed entirely.
- Current: `Tables: []` → `[]`. Replaced by `Tables {}`
- Current: `Tables: [a, b]` → array. Replaced by block syntax.

---

## Task 1: Rewrite the interpreter — remove colon syntax, add `{*}` and `*`

**File:** `packages/dbml-parse/src/core/interpreter/elementInterpreter/diagramView.ts`

**Step 1: Understand what to remove vs keep**

Methods to **DELETE** (colon/list syntax):
- `interpretColonSyntax()` (line 131–196)
- `interpretValueForCategory()` (line 201–243)
- `interpretColonSyntaxElement()` (line 249–280)
- `interpretColonSyntaxTopLevel()` (line 285–288)
- `interpretCategoryList()` (line 347–377)
- `interpretSingleItem()` (line 382–408)
- `extractListItems()` (line 413–450)
- `extractNameFromInfixExpression()` (line 455–482)

Methods to **KEEP** (block syntax):
- `setCategoryToAll()` (line 293–315) — keep, used by new `{*}` logic
- `setCategoryToEmpty()` (line 320–342) — keep
- `interpretTableList()` (line 484–501)
- `interpretNoteList()` (line 503–517)
- `interpretTableGroupList()` (line 519–533)
- `interpretSchemaList()` (line 535–549)

**Step 2: Write the new `interpretBody()` method**

The new body logic:

```typescript
private interpretBody(body: BlockExpressionNode | FunctionApplicationNode | undefined): CompileError[] {
  // No body — all categories [] (show nothing)
  if (!body) {
    this.diagramView.visibleEntities!.tables = [];
    this.diagramView.visibleEntities!.schemas = [];
    this.diagramView.visibleEntities!.tableGroups = [];
    this.diagramView.visibleEntities!.stickyNotes = [];
    return [];
  }

  // Only BlockExpressionNode is valid now (no top-level colon syntax)
  if (!(body instanceof BlockExpressionNode)) {
    return [];
  }

  // Empty block — all categories [] (show nothing)
  if (!body.body || body.body.length === 0) {
    this.diagramView.visibleEntities!.tables = [];
    this.diagramView.visibleEntities!.schemas = [];
    this.diagramView.visibleEntities!.tableGroups = [];
    this.diagramView.visibleEntities!.stickyNotes = [];
    return [];
  }

  // Check for top-level * — show all for every category
  // A FunctionApplicationNode at block level with callee = VariableNode('*')
  const hasGlobalStar = body.body.some((element) => {
    if (element instanceof FunctionApplicationNode) {
      const callee = element.callee;
      if (callee instanceof PrimaryExpressionNode && callee.expression instanceof VariableNode) {
        return callee.expression.variable?.value === '*';
      }
      if (callee instanceof VariableNode) {
        return callee.variable?.value === '*';
      }
    }
    return false;
  });

  if (hasGlobalStar) {
    this.diagramView.visibleEntities!.tables = null;
    this.diagramView.visibleEntities!.schemas = null;
    this.diagramView.visibleEntities!.tableGroups = null;
    this.diagramView.visibleEntities!.stickyNotes = null;
    return [];
  }

  // Initialize all categories to [] (show nothing)
  this.diagramView.visibleEntities!.tables = [];
  this.diagramView.visibleEntities!.schemas = [];
  this.diagramView.visibleEntities!.tableGroups = [];
  this.diagramView.visibleEntities!.stickyNotes = [];

  const errors: CompileError[] = [];

  for (const element of body.body) {
    if (!(element instanceof ElementDeclarationNode)) continue;

    const type = element.type?.value.toLowerCase();

    // Check for {*} syntax: Tables: {*}
    // This is parsed as ElementDeclarationNode with body = FunctionApplicationNode
    // whose callee is a BlockExpressionNode containing a * variable
    if (element.body instanceof FunctionApplicationNode) {
      const callee = element.body.callee;
      if (callee instanceof BlockExpressionNode) {
        // Check if block contains only *
        const isStarBlock = callee.body?.length === 1 && (() => {
          const first = callee.body![0];
          if (first instanceof FunctionApplicationNode) {
            const innerCallee = first.callee;
            if (innerCallee instanceof PrimaryExpressionNode && innerCallee.expression instanceof VariableNode) {
              return innerCallee.expression.variable?.value === '*';
            }
            if (innerCallee instanceof VariableNode) {
              return innerCallee.variable?.value === '*';
            }
          }
          return false;
        })();

        if (isStarBlock && type) {
          this.setCategoryToAll(type);
          continue;
        }
      }
    }

    // Block syntax: Tables { users \n posts }
    const subBody = element.body as BlockExpressionNode | undefined;

    switch (type) {
      case 'tables':
        errors.push(...this.interpretTableList(subBody));
        break;
      case 'notes':
      case 'sticky_notes':
        errors.push(...this.interpretNoteList(subBody));
        break;
      case 'tablegroups':
      case 'table_groups':
        errors.push(...this.interpretTableGroupList(subBody));
        break;
      case 'schemas':
        errors.push(...this.interpretSchemaList(subBody));
        break;
      default:
        break;
    }
  }

  return errors;
}
```

**Step 3: Remove unused imports**

After deleting the colon methods, remove unused imports from the top of the file:
- Remove: `ListExpressionNode, AttributeNode, IdentiferStreamNode, InfixExpressionNode` (if unused)
- Keep: `BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode, VariableNode, PrimaryExpressionNode`

**Step 4: Write the new complete file**

Replace the entire file with the cleaned version: `interpretName`, `interpret`, `interpretBody` (new), `setCategoryToAll`, `setCategoryToEmpty`, `interpretTableList`, `interpretNoteList`, `interpretTableGroupList`, `interpretSchemaList`.

**Step 5: Run the interpreter tests**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
yarn test --reporter=verbose 2>&1 | grep -E "FAIL|PASS|×|✓" | head -40
```

Expected: interpreter-related tests fail (snapshots need updating), others pass.

---

## Task 2: Rewrite the binder — remove colon list binding

**File:** `packages/dbml-parse/src/core/analyzer/binder/elementBinder/diagramView.ts`

**Step 1: Delete `bindTableReferencesFromList()`** (lines 111–157)

**Step 2: Simplify `bindBody()`** — remove the colon-syntax branch for Tables:

Replace the `tables` case from:
```typescript
case 'tables': {
  if (element.body instanceof FunctionApplicationNode
    && element.body.callee instanceof ListExpressionNode) {
    errors.push(...this.bindTableReferencesFromList(element.body.callee));
  } else {
    errors.push(...this.bindTableReferences(element.body as BlockExpressionNode | undefined));
  }
  break;
}
```

With:
```typescript
case 'tables': {
  // For {*} syntax: Tables: {*} — no binding needed, it means show all
  // For block syntax: Tables { users } — bind normally
  if (!(element.body instanceof FunctionApplicationNode)) {
    errors.push(...this.bindTableReferences(element.body as BlockExpressionNode | undefined));
  }
  break;
}
```

**Step 3: Remove unused imports** — `ListExpressionNode` is no longer needed if unused elsewhere.

**Step 4: Run tests**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
yarn test --reporter=verbose 2>&1 | grep -E "FAIL|×" | head -20
```

---

## Task 3: Rewrite the validator — remove colon syntax validation

**File:** `packages/dbml-parse/src/core/analyzer/validator/elementValidators/diagramView.ts`

**Step 1: Identify methods to delete**

Read the file and find:
- `validateTableListItems()` — validates `Tables: [a, b]` list items
- `validateTableGroupListItems()` — validates `TableGroups: [a, b]` list items
- All branches in `validateTableReferences()` that check `element.body instanceof FunctionApplicationNode && element.body.callee instanceof ListExpressionNode`
- Same pattern in `validateNoteReferences()` and `validateTableGroupReferences()`

**Step 2: Simplify each validate method**

For `validateTableReferences()`, remove the colon-list branch. Only keep the block-syntax branch:
```typescript
private validateTableReferences(...): CompileError[] {
  // Only handle block syntax: Tables { users }
  // {*} syntax (Tables: {*}) means show all — no validation needed
  if (element.body instanceof FunctionApplicationNode) {
    return []; // {*} case or unknown — skip
  }
  // Block syntax validation (existing code)
  ...
}
```

**Step 3: Run tests**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
yarn test --reporter=verbose 2>&1 | grep -E "FAIL|×" | head -20
```

---

## Task 4: Rewrite the transform — new output format

**File:** `packages/dbml-parse/src/compiler/queries/transform/diagramView.ts`

**Step 1: Remove `formatEntityList()`** (lines 28–34) — used only for colon list output `[a, b, c]`

**Step 2: Rewrite `generateDiagramViewDbml()`**

Old output (to remove):
```
Tables: [users, orders]
Tables: all
Tables: []
Notes: all
Notes: []
```

New output format:
```typescript
function generateDiagramViewDbml(name: string, filterConfig: DiagramViewFilterConfig): string {
  const quotedName = quoteNameIfNeeded(name);

  // Special case: all categories are null → use top-level *
  const allNull = filterConfig.tables === null
    && filterConfig.schemas === null
    && filterConfig.tableGroups === null
    && filterConfig.stickyNotes === null;

  if (allNull) {
    return `DiagramView ${quotedName} {\n  *\n}`;
  }

  const lines: string[] = [`DiagramView ${quotedName} {`];

  // tables
  if (filterConfig.tables === null) {
    lines.push('  Tables: {*}');
  } else if (filterConfig.tables.length > 0) {
    lines.push('  Tables {');
    for (const t of filterConfig.tables) {
      const ref = t.schemaName != null ? `${t.schemaName}.${t.name}` : t.name;
      lines.push(`    ${ref}`);
    }
    lines.push('  }');
  } else {
    lines.push('  Tables {}');
  }

  // notes (stickyNotes)
  if (filterConfig.stickyNotes === null) {
    lines.push('  Notes: {*}');
  } else if (filterConfig.stickyNotes.length > 0) {
    lines.push('  Notes {');
    for (const n of filterConfig.stickyNotes) {
      lines.push(`    ${n.name}`);
    }
    lines.push('  }');
  } else {
    lines.push('  Notes {}');
  }

  // tableGroups
  if (filterConfig.tableGroups === null) {
    lines.push('  TableGroups: {*}');
  } else if (filterConfig.tableGroups.length > 0) {
    lines.push('  TableGroups {');
    for (const g of filterConfig.tableGroups) {
      lines.push(`    ${g.name}`);
    }
    lines.push('  }');
  } else {
    lines.push('  TableGroups {}');
  }

  // schemas
  if (filterConfig.schemas === null) {
    lines.push('  Schemas: {*}');
  } else if (filterConfig.schemas.length > 0) {
    lines.push('  Schemas {');
    for (const s of filterConfig.schemas) {
      lines.push(`    ${s.name}`);
    }
    lines.push('  }');
  } else {
    lines.push('  Schemas {}');
  }

  lines.push('}');
  return lines.join('\n');
}
```

**Step 3: No changes needed** for `findDiagramViewToken`, `getExistingDbmlViewNames`, `createDiagramView`, `updateDiagramView`, `renameDiagramView`, `deleteDiagramView`, `syncDiagramViews` — these only call `generateDiagramViewDbml` which is already updated.

**Step 4: Run tests**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
yarn test --reporter=verbose 2>&1 | grep -E "FAIL|×" | head -20
```

---

## Task 5: Update snapshot input files

These files need to be rewritten to use the new syntax.

**Step 1: Rewrite `diagram_view_new_syntax.in.dbml`**

File: `packages/dbml-parse/__tests__/snapshots/interpreter/input/diagram_view_new_syntax.in.dbml`

```dbml
Table users {
  id int [pk]
}

Table posts {
  id int [pk]
}

Note reminder {
  'Remember to add indexes'
}

TableGroup blog {
  users
  posts
}

// Show all tables using {*}
DiagramView "Show All Tables" {
  Tables: {*}
}

// Show nothing — all empty blocks
DiagramView "Show Nothing" {
  Tables {}
  Notes {}
  TableGroups {}
  Schemas {}
}

// Show specific tables
DiagramView "Specific Tables" {
  Tables {
    users
    posts
  }
}

// Show specific notes
DiagramView "Specific Notes" {
  Notes {
    reminder
  }
}

// Mixed — specific tables and notes
DiagramView "Mixed Syntax" {
  Tables {
    users
  }
  Notes {
    reminder
  }
  TableGroups {
    blog
  }
}

// Show all everything using top-level *
DiagramView "All" {
  *
}
```

**Step 2: Rewrite `diagram_view_empty_categories.in.dbml`**

File: `packages/dbml-parse/__tests__/snapshots/interpreter/input/diagram_view_empty_categories.in.dbml`

```dbml
Table users {
  id int [pk]
}

DiagramView empty_view {
  Tables {}
}
```

**Step 3: Rewrite `diagram_view_partial_categories.in.dbml`**

File: `packages/dbml-parse/__tests__/snapshots/interpreter/input/diagram_view_partial_categories.in.dbml`

```dbml
Table users {
  id int [pk]
}

Table posts {
  id int [pk]
}

DiagramView tables_only {
  Tables {
    users
  }
}
```

**Step 4: Check `diagram_view_case_insensitive.in.dbml`** for colon syntax and update any `Tables: all` or `Tables: []` occurrences to new syntax.

**Step 5: Check `diagram_view_multiple.in.dbml`** for colon syntax and update.

```bash
grep -rn "Tables: all\|Tables: \[\]\|Notes: all\|: all\|: \[\]" \
  /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/__tests__/snapshots/
```

---

## Task 6: Regenerate snapshot output JSON files

Snapshot output `.out.json` files are auto-generated. The easiest approach is to delete them and let the test runner regenerate them.

**Step 1: Delete all DiagramView snapshot output files**

```bash
rm /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/__tests__/snapshots/interpreter/output/diagram_view_*.out.json
```

**Step 2: Run the snapshot tests to regenerate**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
yarn test --reporter=verbose 2>&1 | grep -E "diagram_view" | head -30
```

**Step 3: Verify the regenerated JSON files**

Check that the output JSON files contain the correct `rawDb` values:
- `Tables: {*}` → `"tables": null`
- `Tables { users }` → `"tables": [{"name":"users","schemaName":null}]`
- `Tables {}` → `"tables": []`
- `DiagramView x { * }` → all categories `null`
- `DiagramView x {}` or no body → all categories `[]`

```bash
cat /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/__tests__/snapshots/interpreter/output/diagram_view_new_syntax.out.json | python3 -m json.tool | grep -A2 '"tables"'
```

---

## Task 7: Rewrite the example interpreter test file

**File:** `packages/dbml-parse/__tests__/examples/interpreter/diagramViewNewSyntax.test.ts`

Replace the entire file:

```typescript
import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example] DiagramView new block syntax parsing', () => {
  const baseTables = `
    Table users { id int }
    Table orders { id int }
    Table products { id int }
    Note reminder { 'test' }
    TableGroup blog { users }
  `;

  describe('{*} syntax — show all for a category', () => {
    test('Tables: {*} sets tables to null (show all)', () => {
      const source = `${baseTables}
        DiagramView my_view {
          Tables: {*}
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tables).toBeNull();
      // Other categories omitted → []
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });

    test('Notes: {*} sets stickyNotes to null', () => {
      const source = `${baseTables}
        DiagramView my_view {
          Notes: {*}
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.stickyNotes).toBeNull();
      expect(view.visibleEntities.tables).toEqual([]);
    });

    test('TableGroups: {*} sets tableGroups to null', () => {
      const source = `${baseTables}
        DiagramView my_view {
          TableGroups: {*}
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tableGroups).toBeNull();
    });

    test('Schemas: {*} sets schemas to null', () => {
      const source = `${baseTables}
        DiagramView my_view {
          Schemas: {*}
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.schemas).toBeNull();
    });
  });

  describe('top-level * — show all everything', () => {
    test('DiagramView { * } sets all categories to null', () => {
      const source = `${baseTables}
        DiagramView my_view {
          *
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tables).toBeNull();
      expect(view.visibleEntities.schemas).toBeNull();
      expect(view.visibleEntities.tableGroups).toBeNull();
      expect(view.visibleEntities.stickyNotes).toBeNull();
    });
  });

  describe('empty body — show nothing', () => {
    test('DiagramView x {} sets all categories to []', () => {
      const source = `${baseTables}
        DiagramView empty_view {}
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tables).toEqual([]);
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });

    test('DiagramView x (no body) sets all categories to []', () => {
      const source = `${baseTables}
        DiagramView no_body_view
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tables).toEqual([]);
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });
  });

  describe('omitted categories default to []', () => {
    test('only Tables block present — other categories are []', () => {
      const source = `${baseTables}
        DiagramView my_view {
          Tables {
            users
            orders
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tables).toEqual([
        { name: 'users', schemaName: null },
        { name: 'orders', schemaName: null },
      ]);
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });
  });

  describe('empty category block — show nothing for that category', () => {
    test('Tables {} sets tables to []', () => {
      const source = `${baseTables}
        DiagramView my_view {
          Tables {}
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tables).toEqual([]);
    });
  });

  describe('block syntax — specific items', () => {
    test('Tables block with items', () => {
      const source = `${baseTables}
        DiagramView my_view {
          Tables {
            users
            orders
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tables).toEqual([
        { name: 'users', schemaName: null },
        { name: 'orders', schemaName: null },
      ]);
    });

    test('Tables block with schema-qualified table', () => {
      const source = `
        Table users { id int }
        Table "core"."orders" { id int }
        DiagramView my_view {
          Tables {
            core.orders
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tables).toEqual([
        { name: 'orders', schemaName: 'core' },
      ]);
    });

    test('Notes block with items', () => {
      const source = `${baseTables}
        DiagramView my_view {
          Notes {
            reminder
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.stickyNotes).toEqual([{ name: 'reminder' }]);
    });

    test('TableGroups block with items', () => {
      const source = `${baseTables}
        DiagramView my_view {
          TableGroups {
            blog
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const view = db.diagramViews[0];
      expect(view.visibleEntities.tableGroups).toEqual([{ name: 'blog' }]);
    });
  });
});
```

**Step 2: Run only this test file**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
yarn test __tests__/examples/interpreter/diagramViewNewSyntax.test.ts --reporter=verbose
```

Expected: all new tests pass.

---

## Task 8: Update the compiler transform test file

**File:** `packages/dbml-parse/__tests__/examples/compiler/diagramViewTransform.test.ts`

**Step 1: Update all expected DBML output strings** in the test that currently contain:
- `Tables: all` → `Tables: {*}`
- `Notes: all` → `Notes: {*}`
- `TableGroups: all` → `TableGroups: {*}`
- `Schemas: all` → `Schemas: {*}`
- `Tables: []` → `Tables {}`
- `Notes: []` → `Notes {}`
- `Tables: [users, posts]` → block format:
  ```
  Tables {
    users
    posts
  }
  ```

**Step 2: Run only this test file**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
yarn test __tests__/examples/compiler/diagramViewTransform.test.ts --reporter=verbose
```

Expected: all tests pass.

---

## Task 9: Build and run full test suite

**Step 1: Build `@dbml/parse`**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
yarn build 2>&1 | tail -5
```

Expected output: `✓ built in X.XXs`

**Step 2: Run all `@dbml/parse` tests**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
yarn test 2>&1 | tail -10
```

Expected: all tests pass, 0 failed.

**Step 3: Run all `@dbml/core` tests**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-core
yarn test 2>&1 | tail -10
```

Expected: all tests pass (345 tests).

---

## Task 10: Commit

```bash
cd /Users/huyphung/workspace/dbx/dbml
git add \
  packages/dbml-parse/src/core/interpreter/elementInterpreter/diagramView.ts \
  packages/dbml-parse/src/core/analyzer/binder/elementBinder/diagramView.ts \
  packages/dbml-parse/src/core/analyzer/validator/elementValidators/diagramView.ts \
  packages/dbml-parse/src/compiler/queries/transform/diagramView.ts \
  packages/dbml-parse/__tests__/examples/interpreter/diagramViewNewSyntax.test.ts \
  packages/dbml-parse/__tests__/examples/compiler/diagramViewTransform.test.ts \
  packages/dbml-parse/__tests__/snapshots/interpreter/input/ \
  packages/dbml-parse/__tests__/snapshots/interpreter/output/

git commit -m "feat: replace colon syntax with block syntax for DiagramView

- Remove Tables: all / Tables: [] / Tables: [a,b] colon syntax
- Add Tables: {*} for show-all, Tables {} for show-nothing
- Add top-level * inside DiagramView body to show everything
- No body / empty body both mean show nothing (all categories [])
- Update interpreter, binder, validator, transform, and all tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
