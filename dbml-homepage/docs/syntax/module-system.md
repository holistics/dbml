---
title: Module System
---

# Module System

A single DBML file can grow very large, making it difficult to navigate, maintain, and collaborate on. The module system lets you split a schema across multiple files — keeping things organized by domain, sharing common definitions across projects, and importing only what you need.

- [Overview](#overview)
- [Selective Import](#selective-import)
  - [Supported Import Types](#supported-import-types)
  - [Import Aliases](#import-aliases)
- [Import All](#import-all)
- [Re-Exporting with `reuse`](#re-exporting-with-reuse)
- [Notes](#notes)

## Overview

Use `use` to import elements from another file:

```text
use {
  type name
} from './path-to-file'
```

- **`type`** — the element type: `table`, `enum`, `tablepartial`, `note`, `schema`, or `tablegroup`. See [Supported Import Types](#supported-import-types).
- **`name`** — the element name as declared in the source file
- **`./path-to-file`** — a relative path to the source file; the `.dbml` extension is optional (`'./types'` and `'./types.dbml'` both work)

```text
// types.dbml
Enum job_status {
  pending running done
}
```

```text
// jobs.dbml
use {
  enum job_status
} from './types'

Table jobs {
  id int [pk]
  status job_status
}
```

Each file is isolated by default — nothing is visible across files unless explicitly imported.

## Selective Import

You can selectively pick some elements from another file to import into the current file.

```text
// shared.dbml
Table users {
  id int [pk]
}

Enum role {
  admin member
}

Table products {
  id int [pk]
  user_id int [ref: > users.id]
}
```

```text
// products won't be imported here
use {
  table users
  enum role
} from './shared'
```

### Supported Import Types

| Keyword        | What is imported                              |
|----------------|-----------------------------------------------|
| `table`        | Table (records and refs come along with it)   |
| `enum`         | Enum                                          |
| `tablepartial` | TablePartial                                  |
| `note`         | Sticky Note                                   |
| `schema`       | All elements under that schema                |
| `tablegroup`   | TableGroup (all tables in the group)          |

Element type keywords are case-insensitive (`Table`, `TABLE`, and `table` are all valid).

```text
// auth.dbml
Table auth.users {
  id int [pk]
  email varchar
}

Table auth.roles {
  id int [pk]
  name varchar
}

Table auth.sessions {
  id int [pk]
}

TableGroup auth_core {
  auth.users
  auth.roles
}
```

```text
// u is available as a table here
use {
  table auth.users as u
} from './auth'

// auth.users, auth.roles, auth.sessions are available here
use {
  schema auth
} from './auth'

// auth_core, auth.user, auth.roles are available here
use {
  tablegroup auth_core
} from './auth'
```

### Import Aliases

When two files define elements with the same name, use `as` to rename imports and avoid conflicts.

```text
// auth.dbml
Table users {
  id int [pk]
  email varchar
}
```

```text
// billing.dbml
Table users {
  id int [pk]
  amount decimal
}
```

```text
// Alias the tables to avoid name conflicts
use {
  table users as auth_users
} from './auth'

use {
  table users as billing_users
} from './billing'
```

Once aliased, only the alias name is accessible — the original name is not.

## Import All

When you want everything a file exports, use `*` instead of listing each element.

```text
// base.dbml
Table users {
  id int [pk]
}

Table orders {
  id int [pk]
}
```

```text
// Everything from ./base.dbml will be imported
use * from './base'

Ref: orders.user_id > users.id
```

`use *` and selective imports from the same file can coexist; any duplicate names are deduplicated automatically.

## Re-Exporting with `reuse`

`use` makes imported elements available only in the current file. If another file imports the current file, it will **not** see elements brought in via `use`:

```text
// common/index.dbml
use * from './users'
use * from './orders'
```

```text
// main.dbml
// users and orders are NOT available here
use * from './common/index'
```

`reuse` goes one step further — it also makes them visible to any file that imports the current file.

```text
// common/index.dbml
reuse * from './users'
reuse * from './orders'
```

```text
// main.dbml
// users and orders are available here
use * from './common/index'
```

`reuse` is best for cases where you want to expose some schema elements to other consumers, without forcing the consumers to be aware of the internal folder structure of your project.

### The Barrel File Pattern With `reuse`

To illustrate a use case of `reuse`, suppose you have a project named `management` that is split into 3 files for easier personal management: `management/users.dbml`, `management/products.dbml`, `management/orders.dbml`.

With `use`, all consumers of `management` must be aware of your project structure to import everything:

```text
// Consumer's file
use * from './management/users'
use * from './management/products'
use * from './management/orders'
```

This is fragile, as when you decide to reorganize your project (e.g. merge `products` and `orders` into one file), all consumers' schemas will be broken.

With `reuse`, you can do this instead:

```text
// management/index.dbml
// You totally control this file
reuse * from './users'
reuse * from './products'
reuse * from './orders'
```

Now, the consumers only have to import this barrel file:

```text
// Consumer's file
use * from './management/index'
```

This way, you can reorganize your project as you wish, only needing to modify your own barrel file. Your consumers never need to be aware of your changes.

## Notes

**`use` is not transitive** — If `a.dbml` imports `b.dbml` and `b.dbml` imports `c.dbml` via `use`, elements from `c.dbml` would not be available in `a.dbml`. Use [`reuse`](#re-exporting-with-reuse) if you need to pass elements through.

**Circular imports** — Because DBML is declarative, files can reference each other without any issues. For example, `users.dbml` can import from `orders.dbml` and vice versa.

```text
// users.dbml
use { table orders } from './orders'

Table users {
  id int [pk]
}

Ref: users.id < orders.user_id
```

```text
// orders.dbml
use { table users } from './users'

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
}
```
