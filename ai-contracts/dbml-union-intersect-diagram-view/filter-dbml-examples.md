# FilterConfig → DBML Examples (syncDiagramView)

> How `generateDiagramViewBlock` converts FilterConfig to DBML.
> Not 1:1 — case by case for correct rendering behavior.

## Rules

1. **`tableGroups: null`** → frontend backfills standalone tables into tables array; just emit tables as-is, omit tableGroups block
2. **`tables: null` or `schemas: null` with other dims `[]` (no items)** → `Notes { * }` (legacy data, only show notes)
3. **`tables: null` or `schemas: null` with other dims having `[items]`** → apply union rule, emit only dims with items
4. **All Trinity dims are `[]`** → body-level `{ * }`
5. **Some Trinity dims have `[items]`, rest are `[]`** → emit only dims with items, omit `[]` dims
6. **All Trinity dims have `[items]`** → emit all

---

## Group A: Legacy/Tricky Cases (tableGroups is null)

### A1: All null

```typescript
{ tables: null, tableGroups: null, schemas: null, stickyNotes: null }
```
```dbml
DiagramView "V" {
}
```

### A2: tableGroups null, tables have items (frontend backfills standalone tables)

> When tableGroups is null, the frontend auto-adds tables NOT in any group to the tables array.
> So `generateDiagramViewBlock` never sees `tables: []` with `tableGroups: null`.

```typescript
{ tables: [{name:'users', schemaName:'public'}, {name:'standalone1', schemaName:'public'}], tableGroups: null, schemas: [], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Tables { users, standalone1 }
}
```

### A3: tableGroups null, tables have items, schemas have items

```typescript
{ tables: [{name:'users', schemaName:'public'}, {name:'standalone1', schemaName:'public'}], tableGroups: null, schemas: [{name:'sales'}], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Tables { users, standalone1 }
  Schemas { sales }
}
```

### A5: tables null, rest empty

```typescript
{ tables: null, tableGroups: [], schemas: [], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Notes { * }
}
```

### A6: schemas null, rest empty

```typescript
{ tables: [], tableGroups: [], schemas: null, stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Notes { * }
}
```

### A7: tables null + schemas null, tableGroups empty

```typescript
{ tables: null, tableGroups: [], schemas: null, stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Notes { * }
}
```

### A8: tables null with other dims having items — union rule

```typescript
{ tables: null, tableGroups: [{name:'Inv'}], schemas: [{name:'sales'}], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  TableGroups { Inv }
  Schemas { sales }
}
```
> Tables null → omit. Union from groups + schemas. Parser's Trinity omit promotes tables to `[]`.

### A9: schemas null with other dims having items — union rule

```typescript
{ tables: [{name:'users', schemaName:'public'}], tableGroups: [{name:'Inv'}], schemas: null, stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Tables { users }
  TableGroups { Inv }
}
```
> Schemas null → omit. Union from tables + groups.

### A10: All Trinity null, stickyNotes empty (show all notes)

```typescript
{ tables: null, tableGroups: null, schemas: null, stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Notes { * }
}
```

---

## Group B: Normal Cases (all Trinity dims non-null)

### B1: All empty — show everything

```typescript
{ tables: [], tableGroups: [], schemas: [], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  *
}
```

### B2: Only tables filtered

```typescript
{ tables: [{name:'users', schemaName:'public'}, {name:'orders', schemaName:'public'}], tableGroups: [], schemas: [], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Tables { users, orders }
}
```

### B3: Only tableGroups filtered

```typescript
{ tables: [], tableGroups: [{name:'Inventory'}, {name:'Reporting'}], schemas: [], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  TableGroups { Inventory, Reporting }
}
```

### B4: Only schemas filtered

```typescript
{ tables: [], tableGroups: [], schemas: [{name:'sales'}, {name:'analytics'}], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Schemas { sales, analytics }
}
```

### B5: Tables + schemas filtered

```typescript
{ tables: [{name:'users', schemaName:'public'}], tableGroups: [], schemas: [{name:'sales'}], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Tables { users }
  Schemas { sales }
}
```

### B6: Tables + tableGroups filtered

```typescript
{ tables: [{name:'users', schemaName:'public'}], tableGroups: [{name:'Inventory'}], schemas: [], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Tables { users }
  TableGroups { Inventory }
}
```

### B7: tableGroups + schemas filtered

```typescript
{ tables: [], tableGroups: [{name:'Inventory'}], schemas: [{name:'sales'}], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  TableGroups { Inventory }
  Schemas { sales }
}
```

### B8: All three have items

```typescript
{ tables: [{name:'users', schemaName:'public'}], tableGroups: [{name:'Inventory'}], schemas: [{name:'sales'}], stickyNotes: [] }
```
```dbml
DiagramView "V" {
  Tables { users }
  TableGroups { Inventory }
  Schemas { sales }
}
```

---

## Group C: StickyNotes combinations

### C1: Only stickyNotes filtered

```typescript
{ tables: [], tableGroups: [], schemas: [], stickyNotes: [{name:'Note1'}] }
```
```dbml
DiagramView "V" {
  Tables { * }
  Notes { Note1 }
}
```

### C2: Tables + stickyNotes

```typescript
{ tables: [{name:'users', schemaName:'public'}], tableGroups: [], schemas: [], stickyNotes: [{name:'Note1'}] }
```
```dbml
DiagramView "V" {
  Tables { users }
  Notes { Note1 }
}
```
