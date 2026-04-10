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
- [Sticky Notes](#sticky-notes)
- [TableGroup](#tablegroup)
  - [TableGroup Notes](#tablegroup-notes-1)
  - [TableGroup Settings](#tablegroup-settings)
- [DiagramView](#diagramview)
  - [DiagramView Syntax](#diagramview-syntax)
  - [DiagramView Settings](#diagramview-settings)
- [Colors](#colors)

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

Note's value is a string. If your note spans over multiple lines, you can use [multi-line string](./language-reference.md#multi-line-string) to define your note.

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

## DiagramView

`DiagramView` allows users to define multiple views of a database diagram, each focusing on different tables, notes, table groups, or schemas. Views can be defined directly in DBML code for version control and automation.

```text
DiagramView view_name { ... }

// example
DiagramView sales_team {
  Tables { customers orders products }
  TableGroups { sales }
}
```

### DiagramView Syntax

Each view can include one or more of the following categories:

- `Tables`: specific tables to include
- `Notes`: specific sticky notes to include
- `TableGroups`: specific table groups to include
- `Schemas`: specific schemas to include

Use `{ * }` to include all items in a category, or list specific item names one per line:

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

// Filter specific tables
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
