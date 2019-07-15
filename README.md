# DBML - Database Markup Language

DBML (database markup language) is a simple, readable DSL language designed to define database structures.

## Benefits

- It is simple, flexible and highly human-readable
- It is database agnostic, focusing on the essential database structure definition without worrying about the detailed syntaxes of each database
- Comes with a free, simple database visualiser at [dbdiagram.io](http://dbdiagram.io)

(**Coming soon):** A `dbml-to-sql` generator to generate SQL from `.dbml` file

## Example

Example of a database definition of a simple blogging site:

    Table users {
      id integer [primary key]
      username varchar(255) [not null]
      display_name varchar(255)
      role UserRole [not null]
      created_at timestamp [default: 'now()']
    
      indexes {
        created_at,
        username [unique]
      }
    }
    
    Table posts {
      id integer [auto increment, primary key]
      title varchar(255) [not null]
      body text
      user_id integer [ref: >users.id] // inline references
      cat_id integer [ref: >cats.id]
      status PostStatus
    }
    
    Table cats {
      id integer [auto increment, primary key]
      slug varchar(255) [unique]
      name varchar(255)
    }
    
    Ref: posts.user_id > users.id // many-to-one
    Ref: cats.id < posts.cat_id   // one-to-many
    
    Enum UserRole {
      admin
      editor
      viewer
    }
    
    Enum PostStatus {
      public
      private
      draft
    }

## Is this similar to SQL DDL?

Not quite. Despite its name (data "definition" language), DDL is designed mainly to help physically create, modify or remove tables, not to define them.

DDL also comes with a few more drawbacks:

- It is hard to read, especially when trying to add multiple column/table settings together.
- It is database specific (Oracle vs PostgreSQL vs MySQL, etc)
- Since it is imperative (vs declarative), to fully reconstruct a table definition you have to trace through all the code (instead of focusing on just 1 single section).

## How to generate SQL from DBML?

1. Go to dbdiagram.io
2. Type up your DBML code
3. Go to Export > SQL (choose your DB)

## DBML Docs

DBML supports defining the following:
- [Table Definition](#table-definition)
    - Table Alias
    - Table Notes (coming soon)
    - Table Settings
    - Index Definition (NEW)
        - Index Settings
- [Column Definition](#column-definition)
    - Column Settings
    - Default Value (NEW)
- [Relationships & Foreign Key Definitions](#relationships--foreign-key-definitions)
    - Many-to-many relationship
- [Comments](#comments)
- [Metadata Notes](#metadata-notes)
- [Enum Definition](#enum-definition)
- TableGroup, ColorScheme (coming soon)
- [Syntax Consistency](#syntax-consistency)
- [Community Contributions](#community-contributions)

### Table Definition
    
    Table table_name {
        column_name column_type [column_settings]
    }
    
- title of database table is listed as `table_name`
- name of the column is listed as `column_name`
- type of the data in the column listed as `column_type`
- list is wrapped in `curly brackets {}`, for indexes, constraints and table definitions.
- settings are wrapped in `square brackets []`
- string value is be wrapped in a `single quote as 'string'`
- `column_name` is stated in just plain text
- (coming soon) column_name can be wrapped in a `double quote as "column_name"`
    
**Table Alias:** You can alias the table, and use them in the references later on

    Table very_long_user_table as U {
      ...
    }
    
    Ref: U.id < posts.user_id
    
**Table Notes (coming soon):** You can add notes to the table, and refer to them in the visual plane

**Table Settings:** Settings are all defined within square brackets: `[setting1: value1, setting2: value2, setting3, setting4]`

Each setting item can take in 2 forms: `Key: Value` or `keyword`, similar to that of Python function parameters.

- `color: <color_code>`: change the table header color (coming soon)

    Example, `[color: blue]`
    
**Index Definition (NEW):** Indexes allow users to quickly locate and access the data.

    Table bookings {
      id integer [primary key]
      country varchar
      booking_date date
      created_at timestamp

      indexes {
          created_at [note: 'Date']
          booking_date
          (country, booking_date) [unique]
          booking_date [type: 'hash']
          (`id*2`)
          (`id*3`,`getdate()`)
          (`id*3`,id)
      }
    }

Index Settings

- `type`: type of index (btree, gin, gist, hash depending on DB)
- `name`: name of index
- `unique`: unique index

### Column Definition

**Column Settings:** Each column can take have optinal settings, defined in square brackets like:

    Table buildings {
        ...
        address varchar(255) [unique, not null, note: "to include unit number"]
        id integer [ pk, unique, default: 123, note: "Number" ]
    }

The list of column settings you can use:

- `primary key` or `pk`: mark a column as primary key. For composite primary key, refer to the Indexes section
- `null` or `not null`: mark a column null or not null
- `unique`: mark the column unique
- `note: "string to add notes"`: add a metadata note to this column
- `default: some_value`: set a default value of the column, please refer to the Default Value section below (coming soon)
- `auto increment`: mark the column as auto increment (coming soon)

**Default Value (NEW):** You can set default value as:

- number value starts blank: `default: 123` or `default: 123.456`
- string value starts with single quotes: `default: 'some string value'`
- expression value is wrapped with parenthesis: ``default: `now() - interval '5 days'` ``
- boolean (true/false/null): `default: false` or `default: null`

Example,

    Table users {
        id integer [primary key]
        username varchar(255) [not null, unique]
        full_name varchar(255) [not null]
        gender varchar(1) [default: 'm']
        created_at timestamp [default: `now()`]
        rating integer [default: 10]
    }

### Relationships & Foreign Key Definitions
Relationships are used to define foreign key constraints between tables.

    Table posts {
        id integer [primary key]
        user_id integer [ref: > users.id] // many-to-one
    }

    // or this
    Table users {
        id integer [ref: < posts.user_id, ref: < reviews.user_id] // one to many
    }

    // The space after '<' is optional
    
There are 3 types of relationships: one-to-one, one-to-many, and many-to-one

- `<`: one-to-many. E.g: `users.id < posts.user_id`
- `>`: many-to-one. E.g: `posts.user_id > users.id`
- `-`: one-to-one. E.g: `users.id - user_infos.user_id`

In DBML, there are 3 syntaxes to define relationships:

    //Long form
    Ref name_optional {
      table1.field1 < table2.field2
    }

    //Short form:
    Ref name_optional: table1.field1 < table2.field2
    
    // Inline form
    Table posts {
        id integer
        user_id integer [ref: > users.id]
    }
    
**Many-to-many relationship**

For many-to-many relationship, we don't have a syntax for it as we believe it should be represented as 2 many-to-one relationships. For more information, please refer to [https://www.holistics.io/blog/dbdiagram-io-many-to-many-relationship-diagram-generator-script/](https://www.holistics.io/blog/dbdiagram-io-many-to-many-relationship-diagram-generator-script/)

### Comments
You can comment in your code using `//`, so it is easier for you to review the code later.

Example,

    // order_items refer to items from that order
    
### Metadata Notes
You can add notes to your field, so you can easily refer to it when hovering over the field in the diagram canvas.

    column_name column_type [note: 'replace text here']
Example,

    Table orders {
        status varchar [
        note: '
        💸 1 = processing, 
        ✔️ 2 = shipped, 
	    ❌ 3 = cancelled,
	    😔 4 = refunded
	    ']
    }

### Enum Definition
`Enum` allows users to define different values of a particular column.
When hovering over the column in the canvas, the enum values will be displayed.

    enum job_status {
        created [note: 'Waiting to be processed']
        running
        done
        failure
    }

    Table jobs {
        id integer
        status job_status
    }

## Syntax Consistency
DBML is the standard language for database and the syntax is consistent to provide clear and extensive functions.

- curly brackets `{}`: grouping for indexes, constraints and table definitions
- square brackets `[]`: settings
- forward slashes `//`: comments
- `column_name` is stated in just plain text
- single quote as `'string'`: string value
- double quote as `"column_name"`: quoting variable (coming soon)
- backtick `` ` ``: function expression (coming soon)

## Community Contributions

* Emacs Mode for DBML (Contributed by ccod): https://github.com/ccod/dbd-mode
