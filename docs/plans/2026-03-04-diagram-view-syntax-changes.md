# DiagramView DBML Syntax Changes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change DiagramView DBML syntax from `Tables { }` to `Tables: []` and add `: all` support while fixing empty body semantics.

**Architecture:**
- Parser: Change DiagramViewInterpreter to parse new `Tables: [...]` syntax with colon separator
- Frontend: Handle conversion to keep empty arrays as empty when ALL categories are empty (not convert to null)
- Tests: Add new test fixtures for new syntax

**Tech Stack:** TypeScript, DBML Parser, Vue.js frontend

---

## Task 1: Update DiagramViewInterpreter to Parse New Syntax

**Files:**
- Modify: `/Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/src/core/interpreter/elementInterpreter/diagramView.ts`

**Step 1: Read the current implementation**

```bash
cat /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/src/core/interpreter/elementInterpreter/diagramView.ts
```

**Step 2: Understand the parsing flow**

The parser creates:
- `ElementDeclarationNode` for blocks like `Tables { }`
- `FunctionApplicationNode` for colon syntax like `Tables: all`

Current code handles `ElementDeclarationNode` in the body. Need to also handle `FunctionApplicationNode`.

**Step 3: Implement new parsing logic**

Replace the interpretBody method to:
1. Handle `FunctionApplicationNode` (colon syntax: `Tables: [t1, t2]`, `Tables: all`)
2. Handle `ElementDeclarationNode` (block syntax: `Tables { t1 t2 }`) - keep for backward compat
3. Fix empty body: `DiagramView name {}` → all `[]` (show nothing)

```typescript
// New interpretBody logic
private interpretBody(body: BlockExpressionNode | undefined): CompileError[] {
  if (!body) {
    // No body at all - set all to empty arrays (show nothing)
    this.diagramView.visibleEntities = {
      tables: [],
      schemas: [],
      tableGroups: [],
      stickyNotes: [],
    };
    return [];
  }

  const errors: CompileError[] = [];
  const bodyElements = body.body || [];

  for (const element of bodyElements) {
    if (element instanceof FunctionApplicationNode) {
      // Handle: Tables: [t1, t2], Tables: all, Tables: []
      const calleeName = element.callee?.value?.toLowerCase() || '';
      const args = element.args || [];

      if (calleeName === 'tables') {
        errors.push(...this.interpretTableListFromFunctionApp(args));
      } else if (calleeName === 'notes' || calleeName === 'sticky_notes') {
        errors.push(...this.interpretNoteListFromFunctionApp(args));
      } else if (calleeName === 'tablegroups' || calleeName === 'table_groups') {
        errors.push(...this.interpretTableGroupListFromFunctionApp(args));
      } else if (calleeName === 'schemas') {
        errors.push(...this.interpretSchemaListFromFunctionApp(args));
      }
    } else if (element instanceof ElementDeclarationNode) {
      // Handle: Tables { t1 t2 }
      const type = element.type?.value.toLowerCase();
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
      }
    }
  }

  return errors;
}

private interpretTableListFromFunctionApp(args: ExpressionNode[]): CompileError[] {
  if (args.length === 0) {
    this.diagramView.visibleEntities!.tables = [];
    return [];
  }

  // Check for 'all' keyword
  const firstArg = args[0];
  if (firstArg instanceof NormalExpressionNode && firstArg.value?.toLowerCase() === 'all') {
    this.diagramView.visibleEntities!.tables = null;
    return [];
  }

  // Parse array of table names: [t1, t2]
  // Handle as list of function applications
  this.diagramView.visibleEntities!.tables = args
    .filter((e): e is FunctionApplicationNode => e instanceof FunctionApplicationNode)
    .map((field) => {
      const fragments = destructureComplexVariable(field.callee).unwrap();
      const tableName = fragments.pop()!;
      const schemaName = fragments.join('.');
      return { name: tableName, schemaName };
    });

  return [];
}
```

**Step 4: Add helper methods for colon syntax**

Add similar methods for notes, tableGroups, schemas:
- `interpretNoteListFromFunctionApp`
- `interpretTableGroupListFromFunctionApp`
- `interpretSchemaListFromFunctionApp`

Each should handle:
- Empty args → `[]` (show nothing)
- `all` keyword → `null` (show all)
- List of names → array of names

**Step 5: Run tests**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse && npx vitest run --reporter=verbose 2>&1 | head -50
```

Expected: Tests should pass or show expected failures for new syntax

---

## Task 2: Update dbml-core Transform Functions

**Files:**
- Modify: `/Users/huyphung/workspace/dbx/dbml/packages/dbml-core/src/transform/index.js`

**Step 1: Read current implementation**

```bash
head -150 /Users/huyphung/workspace/dbx/dbml/packages/dbml-core/src/transform/index.js
```

**Step 2: Update createDiagramView and updateDiagramView to generate new syntax**

Change from:
```javascript
// Old syntax
DiagramView ${name} {
  Tables { ${tables.join('\n  ')} }
}
```

To:
```javascript
// New syntax
DiagramView ${name} {
  Tables: [${tables.join(', ')}]
}
```

**Step 3: Handle null values (show all)**

When generating DBML:
- `tables: null` → `Tables: all`
- `tables: []` → `Tables: []`

---

## Task 3: Update Frontend Conversion

**Files:**
- Modify: `/Users/huyphung/workspace/dbx/dbdiagram-frontend/src/utils/dbmlDiagramView.ts`

**Step 1: Read current implementation**

```bash
cat /Users/huyphung/workspace/dbx/dbdiagram-frontend/src/utils/dbmlDiagramView.ts
```

**Step 2: Update dbmlDiagramViewToFilterConfig**

The function should:
- Convert parsed DBML visible
- When ALL categories are emptyEntities to FilterConfig arrays `[]`, keep them as `[]` (don't convert to null)
- This preserves "show nothing" semantics

```typescript
export function dbmlDiagramViewToFilterConfig(view: DbmlDiagramView): FilterConfig {
  const result = {
    tables: view.visibleEntities.tables,
    schemas: view.visibleEntities.schemas,
    tableGroups: view.visibleEntities.tableGroups,
    stickyNotes: view.visibleEntities.stickyNotes,
  };

  // Keep empty arrays as-is (don't convert to null)
  // This preserves "show nothing" when user writes Tables: []
  return result;
}
```

Wait - the current implementation just passes through. Let me re-check the frontend logic...

Actually the current code looks fine. The key is that the parser should output `[]` for empty and the frontend should pass it through. The issue is the frontend's `getFilterConfig` which converts empty to `{tables: [], schemas: [], ...}` - but that's a different concern.

---

## Task 4: Add New Test Fixtures

**Files:**
- Create: `/Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/__tests__/snapshots/interpreter/input/diagram_view_new_syntax.in.dbml`
- Create: `/Users/huyphung/workspace/dbx/dbml/packages/dbml-parse/__tests__/snapshots/interpreter/output/diagram_view_new_syntax.out.json`

**Step 1: Create test input file**

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

// Test new colon syntax
DiagramView "Show All Tables" {
  Tables: all
}

DiagramView "Show Nothing" {
  Tables: []
  Notes: []
  TableGroups: []
  Schemas: []
}

DiagramView "Specific Tables" {
  Tables: [users, posts]
}

DiagramView "Specific Notes" {
  Notes: [reminder]
}

DiagramView "Mixed Syntax" {
  Tables: [users]
  Notes: [reminder]
  TableGroups: [blog]
}
```

**Step 2: Generate expected output**

Run parser and capture output:
```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse
node -e "
const { parse } = require('./dist/index.js');
const fs = require('fs');
const input = fs.readFileSync('./__tests__/snapshots/interpreter/input/diagram_view_new_syntax.in.dbml', 'utf-8');
const result = parse(input, 'dbmlv2');
console.log(JSON.stringify(result, null, 2));
"
```

**Step 3: Save output to .out.json**

---

## Task 5: Verify All Tests Pass

**Step 1: Run full test suite**

```bash
cd /Users/huyphung/workspace/dbx/dbml/packages/dbml-parse && npx vitest run 2>&1 | tail -30
```

**Step 2: Check for failures**

If tests fail, fix the implementation until all pass.

---

## Summary of Changes

| File | Change |
|------|--------|
| `dbml-parse/.../diagramView.ts` | Parse new `Tables: []` and `Tables: all` syntax |
| `dbml-core/.../transform/index.js` | Generate new syntax in output |
| `dbdiagram-frontend/.../dbmlDiagramView.ts` | Keep empty arrays as empty |
| Test fixtures | Add new test for colon syntax |

---

**Plan complete and saved to `docs/plans/2026-03-04-diagram-view-syntax-changes.md`.**

Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
