---
title: Syntax
---

# DBML - Full Syntax Docs

DBML (database markup language) is a simple, readable DSL designed to define database structures.

The syntax is organized into three sections:

- **[Core Database Markup](./syntax/core-database-markup)** — Constructs that define database structure and map directly to SQL: tables, columns, indexes, relationships, enums, and more.
- **[Enrichment & Visualization](./syntax/enrichment-visualization)** — Annotation and visual features for diagram & wiki tools like [dbdiagram.io](https://dbdiagram.io) & [dbdocs.io](https://dbdocs.io): notes, sticky notes, table groups, and color settings.
- **[Language Reference](./syntax/language-reference)** — Language-level constructs: comments, multi-line strings, and syntax rules.

## Quick Example

```text
Table users {
  id integer
  username varchar
  role varchar
  created_at timestamp
}

Table posts {
  id integer [primary key]
  title varchar
  body text [note: 'Content of the post']
  user_id integer
  created_at timestamp
}

Ref: posts.user_id > users.id // many-to-one
```
