---
title: Data Dependency
---

# Data Dependency

`Dep` describes **data lineage** — a directional flow of data from an upstream element to a downstream one (for example, a raw table feeding a staging table, or a source column feeding a derived column). It is distinct from `Ref`: a `Ref` models a foreign-key relationship between columns, while a `Dep` models "where this data comes from / where it goes". Deps are used solely to annotate and support the visualization; they have no SQL equivalent.

- [Direction](#direction)
- [Short Form](#short-form)
- [Block Form](#block-form)
- [Block Header Settings](#block-header-settings)
- [Inline Form](#inline-form)
- [Endpoints](#endpoints)
- [Settings](#settings)
- [Uniqueness](#uniqueness)

## Direction

A dep always points from the **upstream** (source) element to the **downstream** (target) element. You can write the direction in either order:

- `->` points from upstream to downstream: `upstream -> downstream`
- `<-` points from downstream to upstream: `downstream <- upstream`

Both operators describe the same directed edge — pick whichever reads more naturally. These two lines are equivalent:

```text
Dep: users -> orders
Dep: orders <- users
```

## Short Form

The short form declares a single edge on one line:

```text
Dep: users -> orders
Dep: orders.user_id <- users.id
```

A `Dep` may optionally be given a name. The name is only a label — it has no effect on the lineage:

```text
Dep pipeline_step: users -> orders
```

## Block Form

The block form groups multiple edges, and lets you attach settings, inside curly braces:

```text
Dep {
  raw_orders -> stg_orders
  stg_orders -> fct_orders
  stg_orders.amount -> fct_orders.revenue

  note: 'Aggregate staging orders into facts'
  color: #79AD51
}
```

Each line inside the block is one edge. Settings such as `note` and `color` are written as their own lines in the block body.

## Block Header Settings

Settings can also be placed in a `[...]` list on the block header, before the opening brace:

```text
Dep [color: #79AD51] {
  raw_orders -> stg_orders
}
```

A named block takes its name before the header list:

```text
Dep etl_flow [color: #79AD51] {
  raw_orders -> stg_orders
}
```

## Inline Form

You can attach a dep directly to a table or a column using the `dep` setting, without writing a separate `Dep` declaration.

On a **table header**, the endpoint is the table itself:

```text
Table mart_orders [dep: <- fct_orders] {
  id int
  total decimal
}
```

On a **column**, the endpoint is that column:

```text
Table fct_orders {
  id int
  revenue decimal [dep: -> reports.revenue]
}
```

The inline `dep` value is a direction operator (`->` or `<-`) followed by the other endpoint. The host table or column supplies the near side of the edge automatically.

## Endpoints

An endpoint can be a whole table or a single column, and may be qualified with a schema:

- Table-level: `table`, or `schema.table`
- Column-level: `table.column`, or `schema.table.column`

Both sides of an edge should refer to the same level — connect a table to a table, or a column to a column:

```text
Dep: my_schema.events -> users
Dep: my_schema.events.id -> users.id
Dep: my_schema.events.id <- another_schema.booking.id
```

When no schema is given, the endpoint resolves in the default `public` schema.

## Settings

Settings are written either in the block header `[...]` list, on a per-edge `[...]` list, or as `key: value` lines inside the block body.

- `note: 'string'`: add a note describing the dependency. See [Note Definition](./enrichment-visualization.md#note-definition). The note can use a [multi-line string](./language-basics.md#multi-line-string).
- `color: <color_code>`: change the color of the lineage line. See [Colors](./enrichment-visualization.md#colors) for accepted color formats.

```text
// header list
Dep [color: #79AD51] {
  raw_orders -> stg_orders
}

// body lines
Dep {
  raw_orders -> stg_orders
  note: 'Nightly load'
  color: #79AD51
}

// per-edge list
Dep {
  raw_orders -> stg_orders [color: #79AD51]
}
```

## Uniqueness

Each directed edge must be unique. Declaring the same edge twice — whether in short form, block form, or inline form — reports the error *"Dep with same endpoints already exists"*:

```text
// error: the same edge is declared twice
Dep: a -> b
Dep: a -> b
```

Uniqueness is checked per direction, so the **reversed** pair is a different edge and is allowed:

```text
// no error: a -> b and b -> a are distinct edges
Dep: a -> b
Dep: b -> a
```

Table-level and column-level edges are also distinct, so `a -> b` and `a.id -> b.id` can both exist.
