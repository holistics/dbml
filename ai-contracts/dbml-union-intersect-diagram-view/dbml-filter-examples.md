# DBML → FilterConfig Examples (Parser)

> How the parser interprets DBML DiagramView blocks to produce FilterConfig.
> TableGroups `*` is always expanded to concrete group names.

## Rules

1. **`{ items }`** → `[items]` (specific items)
2. **`{ * }`** → `[]` for Tables/Schemas/Notes, concrete names for TableGroups
3. **Omitted** → `null` (don't interpret)
4. **`{ }` empty** → `null` (hide all)
5. **Body-level `{ * }`** → all dims `[]` (TableGroups expanded to concrete)
6. **Trinity omit rule**: if any Trinity dim is explicitly set with non-null value, omitted Trinity dims get `[]` (show all)

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
