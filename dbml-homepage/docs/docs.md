---
title: Syntax
---

# DBML - Full Syntax Docs

DBML (database markup language) is a simple, readable DSL language designed to define database structures. This page
outlines the full syntax documentations of DBML.

- [Project Definition](#project-definition)
- [Schema Definition](#schema-definition)
  - [Public Schema](#public-schema)
- [Table Definition](#table-definition)
  - [Table Alias](#table-alias)
  - [Table Notes](#table-notes)
  - [Table Settings](#table-settings)
- [Column Definition](#column-definition)
  - [Column Settings](#column-settings)
  - [Default Value](#default-value)
- [Index Definition](#index-definition)
  - [Index Settings](#index-settings)
- [Relationships & Foreign Key Definitions](#relationships--foreign-key-definitions)
  - [Relationship settings](#relationship-settings)
  - [Many-to-many relationship](#many-to-many-relationship)
- [Enum Definition](#enum-definition)
- [Note Definition](#note-definition)
  - [Project Notes](#project-notes)
  - [Table Notes](#table-notes)
  - [Column Notes](#column-notes)
  - [TableGroup Notes](#tablegroup-notes)
- [Sticky Notes](#sticky-notes)
- [TableGroup](#tablegroup)
    - [TableGroup Notes](#tablegroup-notes-1)
    - [TableGroup Settings](#tablegroup-settings)
- [Table Partial](#table-partial)
  - [Conflict Resolution order](#conflict-resolution-order)
  - [Table Partial example usage](#table-partial-example-usage)
- [Multi-line String](#multi-line-string)
- [Comments](#comments)
- [Syntax Consistency](#syntax-consistency)

## Example

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

For example, the following code will define a new schema `core` along with a table `user` placed inside it

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
  - supports all data types, as long as it is a single word (remove all spaces in the data type). Example, JSON, JSONB, decimal(1,2), etc.
- list is wrapped in `curly brackets {}`, for indexes, constraints and table definitions.
- settings are wrapped in `square brackets []`
- string value is be wrapped in a `single quote as 'string'`
- `column_name` can be stated in just plain text, or wrapped in a `double quote as "column name"`

### Table Alias

You can alias the table, and use them in the references later on.

```text
Table very_long_user_table as U {
  ...
}

Ref: U.id < posts.user_id
```

### Table Notes

You can add notes to the table, and refer to them in the visual plane.

```text
Table users {
  id integer
  status varchar [note: 'status']

  Note: 'Stores user data'
}
```

### Table Settings

Settings are all defined within square brackets: `[setting1: value1, setting2: value2, setting3, setting4]`

Each setting item can take in 2 forms: `Key: Value` or `keyword`, similar to that of Python function parameters.

- `headercolor: <color_code>`: change the table header color.

Example,

```text
Table users [headercolor: #3498DB] {
  id integer [primary key]
  username varchar(255) [not null, unique]
}
```

## Column Definition

### Column Settings

Each column can take have optional settings, defined in square brackets like:

```text
Table buildings {
  ...
  address varchar(255) [unique, not null, note: 'to include unit number']
  id integer [ pk, unique, default: 123, note: 'Number' ]
}
```

The list of column settings you can use:

- `note: 'string to add notes'`: add a metadata note to this column
- `primary key` or `pk`: mark a column as primary key. For composite primary key, refer to the 'Indexes' section
- `null` or `not null`: mark a column null or not null. If you ommit this setting, the column will be null by default
- `unique`: mark the column unique
- `default: some_value`: set a default value of the column, please refer to the 'Default Value' section below
- `increment`: mark the column as auto-increment

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

There are 3 types of index definitions:

- Index with single column (with index name): `CREATE INDEX created_at_index on users (created_at)`
- Index with multiple columns (composite index): `CREATE INDEX on users (created_at, country)`
- Index with an expression: `CREATE INDEX ON films ( first_name + last_name )`
- (bonus) Composite index with expression: `CREATE INDEX ON users ( country, (lower(name)) )`

### Index Settings

- `type`: type of index (btree, gin, gist, hash depending on DB). For now, only type btree and hash are accepted.
- `name`: name of index
- `unique`: unique index
- `pk`: primary key

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

**Zero-to-(one/many)** or **(one/many)-to-zero** relationships will be automatically detected when you combine the relationship with foreign key’s nullable constraint. Like this example:
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

### Relationship settings

```text
// short form
Ref: products.merchant_id > merchants.id [delete: cascade, update: no action, color: #79AD51]

// long form
Ref {
  products.merchant_id > merchants.id [delete: cascade, update: no action, color: #79AD51]
}
```

- `delete / update: cascade | restrict | set null | set default | no action`
Define referential actions. Similar to `ON DELETE/UPDATE CASCADE/...` in SQL.
- `color: <color_code>`: change the relationship color.

*Relationship settings and names are not supported for inline form ref.*

### Many-to-many relationship

There're two ways to represent many-to-many relationship:

- Using a single many-to-many relationship (`<>`).

- Using 2 many-to-one relationships (`>` and `<`). For more information, please refer to [https://community.dbdiagram.io/t/tutorial-many-to-many-relationships/412](https://community.dbdiagram.io/t/tutorial-many-to-many-relationships/412)

Beside presentation aspect, the main differece between these two approaches is how the relationship will be mapped into physical design when exporting to SQL.

## Enum Definition

`Enum` allows users to define different values of a particular column.
When hovering over the column in the canvas, the enum values will be displayed.

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

## Note Definition

Note allows users to give description for a particular DBML element.

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

Note's value is a string. If your note spans over multiple lines, you can use [multi-line string](#multi-line-string) to define your note.

### Project Notes

```text
Project DBML {
  Note: '''
  # DBML - Database Markup Language
  DBML (database markup language) is a simple, readable DSL language designed to define database structures.

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
- `color: <color_code>`: change the table group color.

Example,
```text
TableGroup e_commerce [color: #345] {
  merchants
  countries
}
```

## Table Partial

Table partial is a way to define a table with a set of fields and settings that can be reused in other tables. To define a table partial, you can use the following syntax:

```text
TablePartial partial_name [table_setting] {
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

Note: the order of table own fields and partial injections in the table definition determine their relative fields order in the final output.  

### Conflict Resolution order
When there're multiple conflicting columns or settings with identical names due to partial injection, the following resolution order is applied:
1. Local Table Definition: If a definition exists within the local table, it takes precedence.
2. Last Partial Referenced: If no local definition is found, the definition from the last partial (in dbml source) containing the conflicting name is used.

### Table Partial example usage

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

// result
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

## Multi-line String

Multiline string will be defined between triple single quote `'''`

```text
Note: '''
  This is a block string
  This string can spans over multiple lines.
'''
```

- Line breaks: \<enter\> key
- Line continuation: `\` backslash
- Escaping characters:
  - `\`: using double backslash `\\`
  - `'`: using `\'`
- The number of spaces you use to indent a block string will be the minimum number of leading spaces among all lines. The parser will automatically remove the number of indentation spaces in the final output. The result of the above example will be:

```text
  This is a block string
  This string can spans over multiple lines.
```

## Comments

**Single-line Comments**

You can comment in your code using `//`, so it is easier for you to review the code later.

Example,

```text
// order_items refer to items from that order
```

**Multi-line Comments**

You can also put comment spanning multiple lines in your code by putting inside `/*` and `*/`.

Example,

```text
/*
  This is a
  Multi-lines
  comment
*/
```

## Syntax Consistency

DBML is the standard language for database and the syntax is consistent to provide clear and extensive functions.

- curly brackets `{}`: grouping for indexes, constraints and table definitions
- square brackets `[]`: settings
- forward slashes `//`: comments
- `column_name` is stated in just plain text
- single quote as `'string'`: string value
- double quote as `"column name"`: quoting variable
- triple quote as `'''multi-line string'''`: multi-line string value
- backtick `` ` ``: function expression
