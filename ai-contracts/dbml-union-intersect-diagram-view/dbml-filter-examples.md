# DBML → FilterConfig Examples (Parser)

> How the parser interprets DBML DiagramView blocks to produce FilterConfig.
> TableGroups `*` is always expanded to concrete group names.
> Tables `*` or Schemas `*` triggers union: all Trinity dims become `[]` (show all).

## Rules

1. **`{ items }`** → `[items]` (specific items)
2. **`{ * }`** → `[]` for Tables/Schemas/Notes, concrete names for TableGroups
3. **Omitted** → `null` (don't interpret)
4. **`{ }` empty** → `null` (hide all)
5. **Body-level `{ * }`** → all dims `[]` (TableGroups NOT expanded — body-level)
6. **Trinity omit rule**: if any Trinity dim is explicitly set with non-null value, omitted Trinity dims get `[]` (show all)
7. **Tables/Schemas wildcard union**: if Tables has `*` or Schemas has `*`, all Trinity dims become `[]` (show all). Union with "show all" = show everything. Specific items in other dims are overridden.

---

## Group D: Sub-block with specific items

### D1: Tables only

```dbml
DiagramView "V" {
  Tables { users, orders }
}
```
```typescript
{ tables: [{name:'users', schemaName:'public'}, {name:'orders', schemaName:'public'}],
  tableGroups: [],      // Trinity omit: schemas also → []
  schemas: [],          // Trinity omit: tables is non-null → promote omitted to []
  stickyNotes: null }
```

### D2: TableGroups only

```dbml
DiagramView "V" {
  TableGroups { Inventory, Reporting }
}
```
```typescript
{ tables: [],           // Trinity omit
  tableGroups: [{name:'Inventory'}, {name:'Reporting'}],
  schemas: [],          // Trinity omit
  stickyNotes: null }
```

### D3: Schemas only

```dbml
DiagramView "V" {
  Schemas { sales, analytics }
}
```
```typescript
{ tables: [],           // Trinity omit
  tableGroups: [],      // Trinity omit
  schemas: [{name:'sales'}, {name:'analytics'}],
  stickyNotes: null }
```

### D4: Tables + Schemas

```dbml
DiagramView "V" {
  Tables { users }
  Schemas { sales }
}
```
```typescript
{ tables: [{name:'users', schemaName:'public'}],
  tableGroups: [],      // Trinity omit
  schemas: [{name:'sales'}],
  stickyNotes: null }
```

### D5: Tables + TableGroups

```dbml
DiagramView "V" {
  Tables { users }
  TableGroups { Inventory }
}
```
```typescript
{ tables: [{name:'users', schemaName:'public'}],
  tableGroups: [{name:'Inventory'}],
  schemas: [],           // Trinity omit
  stickyNotes: null }
```

### D6: TableGroups + Schemas

```dbml
DiagramView "V" {
  TableGroups { Inventory }
  Schemas { sales }
}
```
```typescript
{ tables: [],            // Trinity omit
  tableGroups: [{name:'Inventory'}],
  schemas: [{name:'sales'}],
  stickyNotes: null }
```

### D7: All three have items

```dbml
DiagramView "V" {
  Tables { users }
  TableGroups { Inventory }
  Schemas { sales }
}
```
```typescript
{ tables: [{name:'users', schemaName:'public'}],
  tableGroups: [{name:'Inventory'}],
  schemas: [{name:'sales'}],
  stickyNotes: null }
```

---

## Group E: Wildcard sub-blocks

### E1: Wildcard TableGroups + explicit tables + schemas

```dbml
DiagramView "V" {
  Tables { users, orders }
  TableGroups { * }
  Schemas { sales }
}
```
```typescript
{ tables: [{name:'users', schemaName:'public'}, {name:'orders', schemaName:'public'}],
  tableGroups: [{name:'Inventory'}, {name:'Reporting'}],   // expanded from *
  schemas: [{name:'sales'}],
  stickyNotes: null }
```

### E2: Wildcard Tables only

```dbml
DiagramView "V" {
  Tables { * }
}
```
```typescript
{ tables: [],            // * → [] (show all tables)
  tableGroups: [],       // Trinity omit: tables is non-null
  schemas: [],           // Trinity omit
  stickyNotes: null }
```

### E3: Wildcard Schemas only

```dbml
DiagramView "V" {
  Schemas { * }
}
```
```typescript
{ tables: [],            // Trinity omit
  tableGroups: [],       // Trinity omit
  schemas: [],           // * → [] (show all schemas)
  stickyNotes: null }
```

### E4: Wildcard TableGroups only

```dbml
DiagramView "V" {
  TableGroups { * }
}
```
```typescript
{ tables: [],            // Trinity omit: tableGroups expanded to concrete names (non-null) → promote
  tableGroups: [{name:'Inventory'}, {name:'Reporting'}],   // expanded from *
  schemas: [],           // Trinity omit
  stickyNotes: null }
```

---

## Group F: Body-level wildcard

### F1: Body-level { * }

```dbml
DiagramView "V" {
  *
}
```
```typescript
{ tables: [],
  tableGroups: [],       // body-level * → [], NOT expanded
  schemas: [],
  stickyNotes: [] }
```

### F2: Tables wildcard + Notes

```dbml
DiagramView "V" {
  Tables { * }
  Notes { Note1 }
}
```
```typescript
{ tables: [],            // * → []
  tableGroups: [],       // Trinity omit: tables non-null
  schemas: [],           // Trinity omit
  stickyNotes: [{name:'Note1'}] }
```

> Body-level `{ * }` cannot be combined with other sub-blocks. Use `Tables { * }` instead.

---

## Group G: Empty blocks

### G1: Empty body

```dbml
DiagramView "V" {
}
```
```typescript
{ tables: null,
  tableGroups: null,
  schemas: null,
  stickyNotes: null }
```

### G2: Any empty sub-block — same as empty body

```dbml
DiagramView "V" { Tables { } }
DiagramView "V" { TableGroups { } }
DiagramView "V" { Schemas { } }
DiagramView "V" { Notes { } }
```

All equivalent to `DiagramView "V" { }` → all dims `null`.

```typescript
{ tables: null, tableGroups: null, schemas: null, stickyNotes: null }
```

---

## Group H: No Trinity dims, only Notes

### H1: Only Notes

```dbml
DiagramView "V" {
  Notes { Note1, Note2 }
}
```
```typescript
{ tables: null,          // no Trinity dims set → no Trinity omit
  tableGroups: null,
  schemas: null,
  stickyNotes: [{name:'Note1'}, {name:'Note2'}] }
```

---

## Group I: Tables/Schemas wildcard union — * in Tables or Schemas collapses all Trinity to []

> When Tables has `*` or Schemas has `*`, the union covers everything regardless of specific items in other dims.
> Specific items in sibling dims are overridden — `*` in one dim = show all via union.
> TableGroups `*` does NOT trigger this rule — it expands to concrete names instead.

### I1: Tables { items } + Schemas { * }

```dbml
DiagramView "V" {
  Tables { users, orders }
  Schemas { * }
}
```
```typescript
{ tables: [],            // Schemas * → union covers all → all Trinity []
  tableGroups: [],       // overridden by Schemas *
  schemas: [],           // * → [], but also overridden
  stickyNotes: null }
```

### I2: Tables { * } + Schemas { items }

```dbml
DiagramView "V" {
  Tables { * }
  Schemas { sales }
}
```
```typescript
{ tables: [],            // * → [], union covers all
  tableGroups: [],       // overridden by Tables *
  schemas: [],           // overridden by Tables *
  stickyNotes: null }
```

### I3: TableGroups { items } + Tables { * }

```dbml
DiagramView "V" {
  TableGroups { Inventory }
  Tables { * }
}
```
```typescript
{ tables: [],            // * → [], union covers all
  tableGroups: [],       // overridden by Tables *
  schemas: [],           // overridden by Tables *
  stickyNotes: null }
```

### I4: TableGroups { items } + Schemas { * }

```dbml
DiagramView "V" {
  TableGroups { Inventory }
  Schemas { * }
}
```
```typescript
{ tables: [],            // overridden by Schemas *
  tableGroups: [],       // overridden by Schemas *
  schemas: [],           // * → [], union covers all
  stickyNotes: null }
```

### I5: Tables { * } + Schemas { * }

```dbml
DiagramView "V" {
  Tables { * }
  Schemas { * }
}
```
```typescript
{ tables: [],            // both * → all Trinity []
  tableGroups: [],
  schemas: [],
  stickyNotes: null }
```

### I6: Tables { items } + TableGroups { * } — TableGroups * does NOT collapse

```dbml
DiagramView "V" {
  Tables { users }
  TableGroups { * }
}
```
```typescript
{ tables: [{name:'users', schemaName:'public'}],  // preserved — TableGroups * doesn't collapse
  tableGroups: [{name:'Inventory'}, {name:'Reporting'}],  // expanded from *
  schemas: [],            // Trinity omit: tables and tableGroups non-null
  stickyNotes: null }
```

> I6 shows the key difference: TableGroups `*` expands to concrete names but does NOT trigger the union collapse.
> Only Tables `*` and Schemas `*` trigger the collapse because they mean "show all tables/schemas" = show everything.
