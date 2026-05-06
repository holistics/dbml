---
title: Module System
---

# Module System

A single DBML file can grow very large, making it difficult to navigate, maintain, and collaborate on. The module system lets you split a schema across multiple files — keeping things organized by domain, sharing common definitions across projects, and importing only what you need.

- [Overview](#overview)
- [Selective Import](#selective-import)
  - [Supported Import Kinds](#supported-import-kinds)
  - [Importing a Schema](#importing-a-schema)
  - [Importing a TableGroup](#importing-a-tablegroup)
- [Wildcard Import](#wildcard-import)
- [Import Aliases](#import-aliases)
- [Schema-Qualified Import](#schema-qualified-import)
- [Re-Exporting with `reuse`](#re-exporting-with-reuse)
- [Circular Imports](#circular-imports)

## Overview

Use `use` to import elements from another file:

```text
use {
  kind name
} from './path-to-file'
```

- **`kind`** — the element kind: `table`, `enum`, `tablepartial`, `schema`, or `tablegroup`. See [Supported Import Kinds](#supported-import-kinds).
- **`name`** — the element name as declared in the source file
- **`./path-to-file`** — a relative path to the source file; the `.dbml` extension is optional (`'./types'` and `'./types.dbml'` both work)

```text
// types.dbml
Enum job_status {
  pending running done
}

// jobs.dbml
use {
  enum job_status
} from './types'

Table jobs {
  id int [pk]
  status job_status
}
```

Each file is isolated by default — nothing is visible across files unless explicitly imported. Imports are also not transitive: if `a.dbml` imports `b.dbml` and `b.dbml` imports `c.dbml`, elements from `c.dbml` are not available in `a.dbml`.

## Selective Import

When you only need a few specific elements from another file, list them by kind and name.

```text
// types.dbml
Enum job_status {
  pending
  running
  done
}

// jobs.dbml
use {
  enum job_status
} from './types'

Table jobs {
  id int [pk]
  status job_status
}
```

Multiple entries can appear in one block or across separate statements:

```text
use {
  table users
  enum role
} from './shared'

use {
  table orders
} from './orders'
```

Only the named elements become available in the importing file. Everything else in the source file stays out of scope.

### Supported Import Kinds

| Keyword        | What is imported                              |
|----------------|-----------------------------------------------|
| `table`        | Table (records and refs come along with it)   |
| `enum`         | Enum                                          |
| `tablepartial` | TablePartial                                  |
| `schema`       | All elements under that schema                |
| `tablegroup`   | TableGroup (all tables in the group)          |

Element kind keywords are case-insensitive (`Table`, `TABLE`, and `table` are all valid).

### Importing a Schema

When a source file defines multiple tables under the same schema, importing the schema brings all of them in at once instead of listing each table individually.

```text
// auth.dbml
Table auth.users {
  id int [pk]
}

Table auth.roles {
  id int [pk]
}

Table auth.sessions {
  id int [pk]
}

// main.dbml
use {
  schema auth
} from './auth'

Table orders {
  id int [pk]
  user_id int [ref: > auth.users.id]
}
```

All tables, enums, and other elements declared under the `auth` schema become available in `main.dbml` under their original schema-qualified names.

### Importing a TableGroup

Importing a `tablegroup` brings the group definition itself into scope, along with all the tables it references.

```text
// base.dbml
Table users {
  id int [pk]
}

Table posts {
  id int [pk]
  user_id int
}

TableGroup blog {
  users
  posts
}

// main.dbml
use {
  tablegroup blog
} from './base'
```

The `blog` tablegroup and its member tables (`users`, `posts`) are all available in `main.dbml`.

## Wildcard Import

When you want everything a file has to offer, use a wildcard instead of listing each element individually.

```text
// base.dbml
Table users {
  id int [pk]
}

Table orders {
  id int [pk]
}

// main.dbml
use * from './base'

Ref: orders.user_id > users.id
```

Wildcard and selective imports from the same file can coexist; any duplicate names are deduplicated automatically.

## Import Aliases

When two files define elements with the same name, or when you want a shorter name locally, use `as` to rename an import.

```text
// auth.dbml
Table auth.users {
  id int [pk]
  email varchar
}

// main.dbml
use {
  table auth.users as u
} from './auth'

Table orders {
  id int [pk]
  user_id int [ref: > u.id]
}
```

Once aliased, only the alias name (`u`) is accessible — the original name is not. Aliases also strip any schema prefix, so `auth.users as u` is visible as plain `u` in the default schema.

The same element can be imported multiple times under different aliases. Giving two different elements the same alias name is an error.

## Schema-Qualified Import

To import elements that live inside a named schema, qualify the name with the schema.

```text
// auth.dbml
Table auth.users {
  id int [pk]
}

Table auth.roles {
  id int [pk]
}

// main.dbml
use {
  table auth.users
} from './auth'
```

Without an alias the element keeps its schema-qualified name (`auth.users`). Combined with `as`, it is placed in the default schema under the alias:

```text
use {
  table auth.users as u
} from './auth'
// visible as: u  (no schema prefix)
```

## Re-Exporting with `reuse`

When you do want a file to pass elements through to its own importers — for example, a barrel file that composes several sub-files — use `reuse` instead of `use`.

```text
// common/index.dbml
reuse * from './users'
reuse * from './orders'
reuse * from './products'

// main.dbml
use * from './common/index'
```

Consumers of `common/index.dbml` never need to know how the files are organized internally. If you later restructure the sub-files, only the barrel changes — not every consumer.

`reuse` works with selective imports and aliases too:

```text
reuse {
  table users
} from './base'

reuse {
  table auth.users as u
} from './auth'
```

## Circular Imports

Because DBML is declarative, files can freely reference each other without any issues.

```text
// users.dbml
use {
  table orders
} from './orders'

Table users {
  id int [pk]
}

Ref: users.id < orders.user_id

// orders.dbml
use {
  table users
} from './users'

Table orders {
  id int [pk]
  user_id int
}
```
