---
title: Enrichment & Visualization
---

# Enrichment & Visualization

This part covers features specific to diagram & wiki tools like [dbdiagram.io](https://dbdiagram.io) & [dbdocs.io](https://dbdocs.io). These constructs have no SQL equivalent and are used solely to annotate and support the visualization.

- [Note Definition](#note-definition)
  - [Project Notes](#project-notes)
  - [Table Notes](#table-notes)
  - [Column Notes](#column-notes)
  - [Index Notes](#index-notes)
  - [TableGroup Notes](#tablegroup-notes)
- [Custom Metadata](#custom-metadata)
  - [Inline Metadata](#inline-metadata)
  - [Metadata Block](#metadata-block)
  - [Metadata Precedence](#metadata-precedence)
- [Sticky Notes](#sticky-notes)
- [TableGroup](#tablegroup)
  - [TableGroup Notes](#tablegroup-notes-1)
  - [TableGroup Settings](#tablegroup-settings)
- [DiagramView](#diagramview)
- [Colors](#colors)
- [Inactive Ref](#inactive-ref)

## Note Definition

Note allows users to give description for a particular DBML element. Two syntax forms are supported:

```text
Table users {
  id int [pk]
  name varchar

  Note: 'This is a note of this table'
  // or
  Note {
  'This is a note of this table'
  }
}
```

Note's value is a string. If your note spans over multiple lines, you can use [multi-line string](./language-basics.md#multi-line-string) to define your note.

### Project Notes

```text
Project DBML {
  Note: '''
  # DBML - Database Markup Language
  DBML (database markup language) is a simple, readable DSL designed to define database structures.

  ## Benefits

  * It is simple, flexible and highly human-readable
  * It is database agnostic, focusing on the essential database structure definition without worrying about the detailed syntaxes of each database
  * Comes with a free, simple database visualiser at [dbdiagram.io](http://dbdiagram.io)
  '''
}
```

### Table Notes

```text
Table users {
  id int [pk]
  name varchar

  Note: 'Stores user data'
}
```

### Column Notes

You can add notes to your columns, so you can easily refer to it when hovering over the column in the diagram canvas.

```text
column_name column_type [note: 'replace text here']
```

Example,

```text
Table orders {
  status varchar [
  note: '''
  💸 1 = processing,
  ✔️ 2 = shipped,
  ❌ 3 = cancelled,
  😔 4 = refunded
  ''']
}
```

### Index Notes

```text
indexes {
  created_at [name: 'created_at_index', note: 'Date']
}
```

### TableGroup Notes

```text
TableGroup e_commerce [note: 'Contains tables that are related to e-commerce system'] {
  merchants
  countries

  // or
  Note: 'Contains tables that are related to e-commerce system'
}
```

## Custom Metadata

Custom metadata lets you attach arbitrary, free-form key-value annotations to DBML elements - things like a data-classification tag, an SLA, or any other attribute.

Custom metadata is currently supported on [Table](../docs.md#table-definition), [Column](../docs.md#column-definition), [TableGroup](#tablegroup), and [Sticky Notes](#sticky-notes) (as well as columns inside a [TablePartial](../docs.md#tablepartial)).

There are two ways to declare custom metadata: **inline** in the element's settings list, or in a separate **Metadata block**.

Currently, a metadata value can be a **string literal** (e.g. `owner: "data-team"`) or a **color literal** (e.g. `brand_color: #3498DB`).

### Inline Metadata

Add custom key-value pairs directly to an element's `[...]` settings list.

```text
Table users [owner: "data-team", sla_hours: "24", pii: "true"] {
  id int [pk, masking: "partial"]
  email varchar [classification: "confidential"]
}

TableGroup e_commerce [team: "growth"] {
  merchants
  countries
}

Note reminder [author: "docs"] {
  'Remember to review this schema'
}
```

:::note
A key with no value (`[owner]`) or a duplicate key (`[owner: "a", owner: "b"]`) will raise an error.
:::

### Metadata Block

You can also declare metadata separately from the element definition using a `Metadata` block. This is useful for keeping annotations in a dedicated section, or for adding metadata to elements defined elsewhere (including across files).

The block targets an element by kind and name:

```text
Table users {
  id int [pk]
  name varchar
}

TableGroup g1 {
  users
}

Metadata Table users {
  owner: 'scott'
  note: 'scott is the owner'
}

Metadata Column users.id {
  pii: 'true'
  masking: 'partial'
}
```

### Metadata Precedence

An element can get metadata from its **inline settings** and from one or more **Metadata blocks**. When the same key is set in more than one place, the higher-priority source wins.

Priority, lowest to highest:

1. Inline settings
2. Metadata blocks in imported files
3. Metadata blocks in the current file

When two imported files set the same key, the one imported **later** wins.

**Example**

Two files set `owner` on the same table, and `main.dbml` imports both:

```dbml
// schema.dbml
Table users [owner: 'jane'] {   // inline setting
  id int [pk]
}
Metadata Table users {          // beats inline -> 'david'
  owner: 'david'
}

// team.dbml
use * from 'schema'
Metadata Table users {          // beats imported block -> 'alice'
  owner: 'alice'
}

// main.dbml
use * from 'team'
```

## Sticky Notes

You can add sticky notes to the diagram canvas to serve as a quick reminder or to elaborate on a complex idea.

Example,

```text
Table jobs {
  ...
}

Note single_line_note {
  'This is a single line note'
}

Note multiple_lines_note {
'''
  This is a multiple lines note
  This string can spans over multiple lines.
'''
}
```

We also support free-form custom metadata, e.g. `Note reminder [author: "docs"] { 'text' }`. See [Inline Metadata](#inline-metadata).

## TableGroup

`TableGroup` allows users to group the related or associated tables together.

```text
TableGroup tablegroup_name { // tablegroup is case-insensitive.
  table1
  table2
  table3
}

// example
TableGroup e_commerce1 {
  merchants
  countries
}
```

### TableGroup Notes

Table groupings can be annotated with notes that describe their meaning and purpose.

```text
TableGroup e_commerce [note: 'Contains tables that are related to e-commerce system'] {
  merchants
  countries

  // or
  Note: 'Contains tables that are related to e-commerce system'
}
```

### TableGroup Settings

Each table group can take optional settings, defined within square brackets: `[setting1: value1, setting2: value2, setting3, setting4]`

The list of table group settings you can use:
- `note: 'string to add notes'`: add a note to this table group.
- `color: <color_code>`: change the table group color. See [Colors](#colors) for accepted color formats.

We also support free-form custom metadata, e.g. `TableGroup e_commerce [team: "growth"]`. See [Inline Metadata](#inline-metadata).

## DiagramView

`DiagramView` allows users to define multiple views of a database diagram, each focusing on different tables, notes, table groups, or schemas.


Each view can include one or more of the following categories:

- `Tables`: specific tables to include
- `Notes`: specific sticky notes to include
- `TableGroups`: specific table groups to include
- `Schemas`: specific schemas to include

Use `{ * }` to include all items in a category, or specify a line-separated list of names:

```text
// Show all items in all categories
DiagramView full_view {
  Tables { * }
  Notes { * }
  TableGroups { * }
  Schemas { * }
}

// Show nothing (empty view)
DiagramView empty_view {
}

// Select specific tables
DiagramView sales_view {
  Tables {
    users
    orders
    products
  }
}

// Mixed filtering with all items in some categories
DiagramView mixed_view {
  Tables { * }
  Notes { reminder_note }
  TableGroups { group_2 }
  Schemas { core }
}
```

## Colors

Color values are specified as hex codes in shorthand or full form: `#rgb` or `#rrggbb`.

### Table header color

Use `headercolor` on a table to change its header color:

```text
Table users [headercolor: #3498DB] {
  id integer [primary key]
  username varchar(255) [not null, unique]
}
```

### Relationship line color

Use `color` on a relationship to change the color of the relationship line:

```text
// short form
Ref: products.merchant_id > merchants.id [color: #79AD51]

// long form
Ref {
  products.merchant_id > merchants.id [color: #79AD51]
}
```

### TableGroup color

Use `color` on a table group to change its background color:

```text
TableGroup e_commerce [color: #3498DB] {
  merchants
  countries
}
```

### Sticky note color

Use `color` on a sticky note to change its background color.

```text
Note reminder [color: #F4D03F] {
  'This is a reminder'
}
```

If you want to create a floating text without any background, you can specify the `none` color on the sticky note.

```
Note no_color [color: none] {
  'This note has no background color'
}
```

## Inactive Ref

Use `inactive` on a relationship to mark it as inactive. Inactive refs are displayed as a dotted line in the diagram, allowing you to document relationships that are not of immediate focus.

```text
// short form
Ref: posts.user_id > users.id [inactive]

// with other settings
Ref: posts.user_id > users.id [delete: cascade, inactive]

// long form
Ref {
  posts.user_id > users.id [inactive]
}
```
