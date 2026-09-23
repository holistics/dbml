---
title: Data Lineage
---

# Data Lineage

`Dep` lets you describe **data dependency** among tables and their columns. It allows you to model: Which tables (or columns) this table (or column) is computed from? Think of it like a SQL view where the view is computed from one or more source tables (or other views).

- [Dependency Block](#dependency-block)

A **dependency** syntax consists of 3 parts:
- The **upstream** endpoint: The source table (or column) that data come from
- The **downstream** endpoint: The destination table (or column) where the source data are processed and computed to derive a new value
- An arrow (`<-` or `->`) pointing from the **upstream** endpoint to the **downstream** endpoint

A **dependency** can be categorized into one of the three types:
- Table-level dependency: Both the upstream endpoint and the downstream endpoint are tables.
- Column-level dependency: Both the upstream endpoint and the downstream endpoint are columns.
- Mixed-level dependency: One endpoint is a table and the other is a column.

```text
/* Short form */

// `raw_orders` is the upstream table endpoint
// `stg_orders` is the downstream table endpoint
// `->` and `<-` always point from the upstream to the downstream
Dep: raw_orders -> stg_orders
Dep: stg_orders <- raw_orders

// Column-level dependency
Dep: raw_orders.amount -> stg_orders.revenue   // column-level

// Mixed-level dependency: table -> column
// `fct_orders.revenue` is an aggregate over every row of `stg_orders`,
// so the upstream is the whole table, not one of its columns
Dep: stg_orders -> fct_orders.revenue

// Mixed-level dependency: column -> table
// the JSON in `raw_events.payload` is unpacked into
// many columns, so one column is the upstream of a whole table
Dep: raw_events.payload -> stg_events

/* Inline form */
Table fct_orders [dep: <- stg_orders] {
  id int
  revenue decimal [dep: -> report_revenue.total]
}
```

## Dependency Block

When a table is produced by a specific transformation step (e.g. a dbt model, a SQL view, or an ETL job), you can express this transformation using a dependency block:

```
/* Block form: group edges for a transformation step */
Dep order_staging [color: #79AD51] {
  raw_orders -> stg_orders
  raw_payments -> stg_orders
  raw_orders.amount -> stg_orders.revenue

  note: 'Join orders with payments, compute revenue'
  materialized: table
  query: '''
     Transformation query
  '''
  owner: 'data-team'
}
```

Block settings:

- `note`: description of the transformation. Supports [multi-line strings](./language-basics.md#multi-line-string).
- `color`: lineage line color. See [Colors](./enrichment-visualization.md#colors).
- Custom keys (e.g. `materialized`, `owner`) are preserved in the output.

:::note
- All edges in a block must target the **same downstream table**, or columns of that table.
- Each directed edge must be unique. Reversed pairs and different levels are considered distinct.
:::
