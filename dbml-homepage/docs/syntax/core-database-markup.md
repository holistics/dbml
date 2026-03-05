---
title: Core Database Markup
---

# Core Database Markup

This section covers all constructs that define database structure and map directly to SQL output.

- [Project Definition](#project-definition)
- [Schema Definition](#schema-definition)
  - [Public Schema](#public-schema)
- [Table Definition](#table-definition)
  - [Table Alias](#table-alias)
- [Column Definition](#column-definition)
  - [Column Settings](#column-settings)
  - [Default Value](#default-value)
- [Check Definition](#check-definition)
  - [Check Settings](#check-settings)
- [Index Definition](#index-definition)
  - [Index Settings](#index-settings)
- [Relationships & Foreign Key Definitions](#relationships--foreign-key-definitions)
  - [Relationship Settings](#relationship-settings)
  - [Many-to-many relationship](#many-to-many-relationship)
- [Enum Definition](#enum-definition)
- [TablePartial](#tablepartial)
- [Data Sample](#data-sample)
  - [Data Types](#data-types)

## Project Definition

You can give overall description of the project.

```text
Project project_name {
  database_type: 'PostgreSQL'
  Note: 'Description of the project'
}
```

## Schema Definition

A new schema will be defined as long as it contains any table or enum.

For example, the following code will define a new schema `core` along with a table `user` placed inside it:

```text
Table core.user {
  ...
}
```

### Public Schema

By default, any **table**, **relationship**, or **enum** definition that omits `schema_name` will be considered to belong to the `public` schema.

## Table Definition

```text
// table belonged to default "public" schema
Table table_name {
  column_name column_type [column_settings]
}

// table belonged to a schema
Table schema_name.table_name {
  column_name column_type [column_settings]
}
```

- (Optional) title of database schema is listed as `schema_name`. If omitted, `schema_name` will default to `public`
- title of database table is listed as `table_name`
- name of the column is listed as `column_name`
- type of the data in the column listed as `column_type`
  - supports all data types. The type name must not contain spaces; if your type has a space (e.g. `double precision`), wrap it in double quotes: `"double precision"`. Types with parentheses like `decimal(1,2)` or `varchar(255)` are supported as-is.
- list is wrapped in `curly brackets {}`, for indexes, constraints and table definitions.
- settings are wrapped in `square brackets []`
- string value is wrapped in a `single quote as 'string'`
- `column_name` can be stated in just plain text, or wrapped in a `double quote as "column name"`

:::tip
Use [TablePartial](#tablepartial) to reuse common fields, settings and indexes across multiple tables. Inject partials into a table using the `~partial_name` syntax.
:::

### Table Alias

You can alias the table, and use them in the references later on.

```text
Table very_long_user_table as U {
  ...
}

Ref: U.id < posts.user_id
```

## Column Definition

### Column Settings

Each column can have optional settings, defined in square brackets like:

```text
Table buildings {
  ...
  address varchar(255) [unique, not null, note: 'to include unit number']
  id integer [ pk, unique, default: 123, note: 'Number' ]
}
```

The list of column settings you can use:

- `primary key` or `pk`: mark a column as primary key. For composite primary key, refer to the 'Indexes' section
- `null` or `not null`: mark a column null or not null. If you omit this setting, the column will be null by default
- `unique`: mark the column unique
- `default: some_value`: set a default value of the column, please refer to the 'Default Value' section below
- `increment`: mark the column as auto-increment
- ``check: `check expression`‎``: add a check expression to this column using a backtick expression. Multiple checks can be defined on a column. For checks involving multiple columns, refer to the [Check Definition](#check-definition) section
- `note: 'string to add notes'`: add a metadata note to this column *(enrichment & visualization only — see [Column Notes](./enrichment-visualization.md#column-notes))*

**Note:** You can use a workaround for un-supported settings by adding the setting name into the column type name, such as `id "bigint unsigned" [pk]`

### Default Value

You can set default value as:

- number value starts blank: `default: 123` or `default: 123.456`
- string value starts with single quotes: `default: 'some string value'`
- expression value is wrapped with backticks: ``default: `now() - interval '5 days'` ``
- boolean (true/false/null): `default: false` or `default: null`

Example,

```text
Table users {
  id integer [primary key]
  username varchar(255) [not null, unique]
  full_name varchar(255) [not null]
  gender varchar(1) [not null]
  source varchar(255) [default: 'direct']
  created_at timestamp [default: `now()`]
  rating integer [default: 10]
}
```

## Check Definition

Checks allow users to specify custom checks on one or many columns. These checks can be used to enforce check constraints on the possible values of one or many columns, which are otherwise impossible to express.

```text
Table users {
  id integer
  wealth integer
  debt integer

  checks {
    `debt + wealth >= 0` [name: 'chk_positive_money']
  }
}
```

### Check Settings

- `name`: name of check constraint

## Index Definition

Indexes allow users to quickly locate and access the data. Users can define single or multi-column indexes.

```text
Table bookings {
  id integer
  country varchar
  booking_date date
  created_at timestamp

  indexes {
    (id, country) [pk] // composite primary key
    created_at [name: 'created_at_index', note: 'Date']
    booking_date
    (country, booking_date) [unique]
    booking_date [type: hash]
    (`id*2`)
    (`id*3`,`getdate()`)
    (`id*3`,id)
  }
}
```

There are 4 types of index definitions:

- Index with single column (with index name): `CREATE INDEX created_at_index on users (created_at)`
- Index with multiple columns (composite index): `CREATE INDEX on users (created_at, country)`
- Index with an expression: `CREATE INDEX ON films ( first_name + last_name )`
- (bonus) Composite index with expression: `CREATE INDEX ON users ( country, (lower(name)) )`

### Index Settings

- `type`: type of index (btree, gin, gist, hash depending on DB). Supported types: `btree` and `hash`.
- `name`: name of index
- `unique`: unique index
- `pk`: primary key
- `note`: a metadata note for the index *(enrichment & visualization only — see [Index Notes](./enrichment-visualization.md#index-notes))*

## Relationships & Foreign Key Definitions

Relationships are used to define foreign key constraints between tables across schemas.

```text
Table posts {
  id integer [primary key]
  user_id integer [ref: > users.id] // many-to-one
}

// or this
Table users {
  id integer [ref: < posts.user_id, ref: < reviews.user_id] // one to many
}

// The space after '<' is optional
```

There are 4 types of relationships: **one-to-one**, **one-to-many**, **many-to-one** and **many-to-many**

- `<`: one-to-many. E.g: `users.id < posts.user_id`
- `>`: many-to-one. E.g: `posts.user_id > users.id`
- `-`: one-to-one. E.g: `users.id - user_infos.user_id`
- `<>`: many-to-many. E.g: `authors.id <> books.id`

**Zero-to-(one/many)** or **(one/many)-to-zero** relationships will be automatically detected when you combine the relationship with foreign key's nullable constraint. Like this example:
```text
Table follows {
  following_user_id int [ref: > users.id] // many-to-zero
  followed_user_id int [ref: > users.id, null] // many-to-zero
}

Table posts {
  id int [pk]
  user_id int [ref: > users.id, not null] // many-to-one
}
```

In DBML, there are 3 syntaxes to define relationships:

```text
// Long form
Ref name_optional {
  schema1.table1.column1 < schema2.table2.column2
}

// Short form
Ref name_optional: schema1.table1.column1 < schema2.table2.column2

// Inline form
Table schema2.table2 {
  id integer
  column2 integer [ref: > schema1.table1.column1]
}
```

:::note
* When defining one-to-one relationships, ensure columns are listed in the correct order:
  * With long & short form, the second column will be treated as a foreign key.

    E.g: `users.id - user_infos.user_id`, *user_infos.user_id* will be the foreign key.
  * With inline form, the column that have the `ref` definition will be treated as a foreign key.

    E.g:
    ```text
    Table user_infos {
      user_id integer [ref: - users.id]
    }
    ```
    *user_infos.user_id* will be the foreign key.
* If `schema_name` prefix is omitted, it'll default to `public` schema.
:::

**Composite foreign keys:**

```text
Ref: merchant_periods.(merchant_id, country_code) > merchants.(id, country_code)
```

**Cross-schema relationship:**

```text
Table core.users {
  id integer [pk]
}

Table blogging.posts {
  id integer [pk]
  user_id integer [ref: > core.users.id]
}

// or this
Ref: blogging.posts.user_id > core.users.id
```

### Relationship Settings

```text
// short form
Ref: products.merchant_id > merchants.id [delete: cascade, update: no action]

// long form
Ref {
  products.merchant_id > merchants.id [delete: cascade, update: no action]
}
```

- `delete / update: cascade | restrict | set null | set default | no action`:
define referential actions. Similar to `ON DELETE/UPDATE CASCADE/...` in SQL.

For the `color` setting on relationships, see [Colors](./enrichment-visualization.md#colors).

*Relationship settings and names are not supported for inline form ref.*

### Many-to-many relationship

There're two ways to represent many-to-many relationship:

- Using a single many-to-many relationship (`<>`).

- Using 2 many-to-one relationships (`>` and `<`). For more information, please refer to [this tutorial on many-to-many relationships](https://community.dbdiagram.io/t/tutorial-many-to-many-relationships/412)

Beside presentation aspect, the main difference between these two approaches is how the relationship will be mapped into physical design when exporting to SQL.

## Enum Definition

`Enum` allows users to define different values of a particular column.

```text
// enum belonged to default "public" schema
enum job_status {
  created [note: 'Waiting to be processed']
  running
  done
  failure
}

// enum belonged to a schema
enum v2.job_status {
  ...
}

Table jobs {
  id integer
  status job_status
  status_v2 v2.job_status
}
```

**Note:** if `schema_name` prefix is omitted, it'll default to `public` schema

If your enum values contain spaces or other special characters you can use double quotes.

```text
enum grade {
  "A+"
  "A"
  "A-"
  "Not Yet Set"
}
```

## TablePartial

`TablePartial` allows you to define reusable sets of fields, settings, and indexes. You can then inject these partials into multiple table definitions to promote consistency and reduce repetition.

**Syntax**

To define a table partial:
```text
TablePartial partial_name [table_settings] {
  field_name field_type [field_settings]
  indexes {
    (column_name) [index_settings]
  }
}
```

To use a table partial, you can reference (also called injection) it in the table definition using the `~` prefix:

```text
Table table_name {
  ~partial_name
  field_name field_type
  ~another_partial
}
```

**Example**

```text
TablePartial base_template [headerColor: #ff0000] {
  id int [pk, not null]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]
}

TablePartial soft_delete_template {
  delete_status boolean [not null]
  deleted_at timestamp [default: `now()`]
}

TablePartial email_index {
  email varchar [unique]

  indexes {
    email [unique]
  }
}

Table users {
  ~base_template
  ~email_index
  name varchar
  ~soft_delete_template
}
```

Final result:

```text
Table users [headerColor: #ff0000] {
  id int [pk, not null]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]
  email varchar [unique]
  name varchar
  delete_status boolean [not null]
  deleted_at timestamp [default: `now()`]

  indexes {
    email [unique]
  }
}
```

**Conflict Resolution**

When multiple partials define the same field, setting or index, DBML resolves conflicts based on the following priority:

1. Local Table Definition: Fields, settings and indexes defined directly in the table override those from partials.
2. Last Injected Partial: If a conflict exists between partials, the definition from the last-injected partial (in source order) takes precedence.

## Data Sample

`Records` allows you to define sample data for your tables directly in DBML. This is useful for documentation, testing, and providing example data for your database schema.

Records can be defined either outside or inside a table definition.

When the column list is omitted, records will automatically use all table columns in their definition order. **Implicit column lists are only supported for records defined inside a table.**

```text
// Outside table definition
Table users {
  id int [pk]
  name varchar
  email varchar
}

records users(id, name, email) {
  1, 'Alice', 'alice@example.com'
  2, 'Bob', 'bob@example.com'
}

// Inside table definition with explicit column list
Table posts {
  id int [pk]
  title varchar
  published boolean

  records (id, title, published) {
    1, 'First Post', true
    2, 'Second Post', false
  }
}

// Inside table definition with implicit column list
Table comments {
  id int [pk]
  user_id int [ref: > users.id]
  post_id int [ref: > posts.id]
  title string

  records {
    1, 2, 1, 'First comment of first post by the second user'
  }
}
```

:::note
Each table can have only one records block. You cannot define duplicate records block for the same table.
:::

When using implicit columns with tables that inject partials using `~partial_name`, the column order follows the same precedence rules as [TablePartial](#tablepartial) injection.

### Data Types

Records use CSV-style syntax. Each value is interpreted and type-checked according to the target column's SQL type.

| Data Type | Syntax | Examples |
|-----------|--------|----------|
| **Strings** | Wrapped in single quotes. Escape single quotes using `\'` | `'Hello World'`<br/>`'Escape\'s sequence'` |
| **Numbers** | Integer or decimal values with or without quotes | `42`, `3.14`, `-100`, `1.5e10` |
| **Booleans** | All boolean constants are case-insensitive | `true`, `false`<br/>`'true'`, `'false'`<br/>`'Y'`, `'N'`<br/>`'T'`, `'F'`<br/>`1`, `0`<br/>`'1'`, `'0'` |
| **Null** | Explicit NULL literal, empty string (non-string types only), or empty field | `null`<br/>`''`<br/>Empty field: `, ,` |
| **Timestamps/Dates** | Wrapped in single quotes. Supports ISO 8601 and other sensible formats | `'2024-01-15 10:30:00'`<br/>`'2024-01-15T10:30:00.000+07:00'`<br/>`'2024-01-15'`<br/>`'10:30:00'` |
| **Enum Values** | Enum constant or string literal | `Status.active`<br/>`'inactive'` |
| **Expressions** | Wrapped in backticks for database functions. Disables static type checking | `` `now()` ``<br/>`` `uuid_generate_v4()` ``<br/>`` `1 + 2 * 3` `` |

**Example:**

```text
enum Status {
  active
  inactive
  pending
}

Table users {
  id int
  name varchar
  age int
  status Status
  created_at timestamp
}

records users(id, name, age, status, created_at) {
  1, 'Alice', 30, Status.active, '2024-01-15 10:30:00'
  2, 'Bob', null, 'inactive', `now()`
  3, 'Charlie', , Status.pending, '2024-01-15'
}
```
