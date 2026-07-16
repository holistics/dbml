---
title: Data Dependency
---

# Data Dependency

`Dep` lets you describe **data lineage** in your database. While `Ref` models foreign-key relationships between columns, `Dep` models where data comes from and where it goes. This is useful for documenting data pipelines, ETL flows, and transformation logic.

There are two common ways to use `Dep`:

- **Quick annotations**: sprinkle short-form or inline deps throughout your schema to mark data flow between tables and columns as you define them.
- **Transform blocks**: group all the inputs of a transformation into a single `Dep` block, annotated with notes and custom properties, to document a complete pipeline step.

Deps have no SQL equivalent and are used solely for annotation and visualization.

- [Direction](#direction)
- [Annotating Data Flow](#annotating-data-flow)
- [Documenting a Transform](#documenting-a-transform)
- [Full Example](#full-example)

## Direction

A dep edge always points from **upstream** (source) to **downstream** (target). You can write it in either direction:

```text
// upstream -> downstream
Dep: raw_orders -> stg_orders

// downstream <- upstream (same edge, different reading order)
Dep: stg_orders <- raw_orders
```

Pick whichever reads more naturally in context.

## Annotating Data Flow

The simplest way to document data flow is to add deps where you define your tables and columns.

**Short form** declares a single edge on one line:

```text
Dep: raw_orders -> stg_orders
Dep: raw_orders.amount -> stg_orders.revenue
```

**Inline form** attaches a dep directly to a table or column, without a separate `Dep` declaration:

```text
// on a table header: the table itself is the endpoint
Table mart_orders [dep: <- fct_orders] {
  id int
  total decimal
}

// on a column: the column is the endpoint
Table fct_orders {
  id int
  revenue decimal [dep: <- stg_orders.amount]
}
```

You can freely use multiple short-form and inline deps targeting the same table:

```text
Dep: raw_orders -> stg_orders
Dep: raw_payments -> stg_orders
```

### Endpoints

Each endpoint can be a table or a column, optionally qualified with a schema:

```text
// table-level
Dep: my_schema.events -> users

// column-level
Dep: my_schema.events.id -> users.id
```

Both sides of an edge must refer to the same level (table-to-table or column-to-column). When no schema is given, the endpoint resolves in the default `public` schema.

Each directed edge must be unique. Declaring the same edge twice is an error. The reversed pair (`a -> b` and `b -> a`) and different levels (`a -> b` and `a.id -> b.id`) are considered distinct and can coexist.

## Documenting a Transform

When a table is produced by a specific transformation step (e.g. a dbt model, a SQL view, or an ETL job), you can group all its input edges into a single `Dep` block and attach properties describing the transform:

```text
Dep {
  raw_orders -> stg_orders
  raw_payments -> stg_orders
  raw_orders.amount -> stg_orders.revenue

  note: 'Clean and join raw order + payment data'
  materialized: table
  owner: 'data-team'
}
```

A block can optionally have a name (used as a label only) and header settings:

```text
Dep order_staging [color: #79AD51] {
  raw_orders -> stg_orders
  raw_payments -> stg_orders
}
```

### Settings

You can add settings in the block header `[...]`, or as `key: value` lines inside the block body:

- `note`: a description of the dependency. Supports [multi-line strings](./language-basics.md#multi-line-string).
- `color`: the color of the lineage line. See [Colors](./enrichment-visualization.md#colors).
- Custom keys (e.g. `materialized`, `owner`) are preserved and available in the output.

### Block rules

Because a block represents a single transform step, two rules apply:

1. All edges must target the **same downstream table**.
2. Only **one block** can target a given downstream table.

```text
// ok: all edges flow into stg_orders
Dep {
  raw_orders -> stg_orders
  raw_payments -> stg_orders
}

// error: edges target different downstream tables
Dep {
  raw_orders -> stg_orders
  raw_users -> stg_users
}
```

Short-form and inline deps also cannot target a table that already has a block:

```text
// error: short-form conflicts with existing block
Dep { raw_orders -> stg_orders }
Dep: raw_payments -> stg_orders

// ok: put all edges inside the block
Dep {
  raw_orders -> stg_orders
  raw_payments -> stg_orders
}
```

## Full Example

A small data pipeline with raw, staging, and fact layers:

```text
Table raw_orders {
  id int [pk]
  user_id int
  amount decimal
}

Table raw_payments {
  id int [pk]
  order_id int
  amount decimal
}

Table stg_orders {
  id int [pk]
  user_id int
  revenue decimal
}

Table fct_daily_revenue {
  date date [pk]
  total_revenue decimal
}

// Quick annotations: mark raw-to-staging flow
Dep: raw_orders.user_id -> stg_orders.user_id

// Transform block: document the staging step
Dep order_staging [color: #79AD51] {
  raw_orders -> stg_orders
  raw_payments -> stg_orders
  raw_orders.amount -> stg_orders.revenue

  note: 'Join orders with payments, compute revenue'
  materialized: table
  owner: 'data-team'
}

// Inline: mark fact table dependency right where it's defined
Table fct_daily_revenue [dep: <- stg_orders] {
  date date [pk]
  total_revenue decimal [dep: <- stg_orders.revenue]
}
```
