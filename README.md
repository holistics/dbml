# DBML - Database Markup Language

DBML (database markup language) is a simple, readable DSL language designed to define database structures.

### Benefits

- It is simple, flexible and highly human-readable
- It is database agnostic, focusing on the essential database structure definition without worrying about the detailed syntaxes of each database
- Comes with a free, simple database visualiser at [dbdiagram.io](http://dbdiagram.io)

(**Coming soon):** A `dbml-to-sql` generator to generate SQL from `.dbml` file

### Example

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

### Is this similar to SQL DDL?

Not quite. Despite its name (data "definition" language), DDL is designed mainly to help physically create, modify or remove tables, not to define them.

DDL also comes with a few more drawbacks:

- It is hard to read, especially when trying to add multiple column/table settings together.
- It is database specific (Oracle vs PostgreSQL vs MySQL, etc)
- Since it is imperative (vs declarative), to fully reconstruct a table definition you have to trace through all the code (instead of focusing on just 1 single section).

### How to generate SQL from DBML?

1. Go to dbdiagram.io
2. Type up your DBML code
3. Go to Export > SQL (choose your DB)

## DBML Docs

- Table Definitions
- Foreign Key Definitions
- Index Definitions

### Table Definition

    Table users {
      id integer [primary key]
      username varchar(255) [not null, unique]
      full_name varchar(255) [not null]
      gender varchar(1)
      created_at timestamp [default: 'now()']
    }
    
    Table posts as P {
      id integer [primary key]
      user_id integer
    }

**Table Alias:** You can alias the table, and use them in the references later on

    Table very_long_user_table as U {
      ...
    }
    
    Ref: U.id < posts.user_id

### Column Settings

Each column can take have optinal settings, defined in square brackets like so:

    Table buildings {
      ...
      address varchar [unique, not null]
    }

`username varchar(255) [unique, not null]`

The list of column settings you can use:

- `primary key`: mark a column as primary key. For composite primary key, refer to Indexes section.
- `not null` or `null`: mark a column null or not null
- `unique`: mark the column unique
- `default: some_value`: set a default value of the column. *(coming soon)*
- `note: "string to add notes"`: add a metadata note to this column *(coming soon)*

### Foreign Key (References) Definition

Long form:

    Ref name_optional {
      table1.field1 < table2.field2
    }

Short form:

    Ref name_optional: table1.field1 < table2.field2

**Reference Types:**

- `<`: one-to-many. E.g: `users.id < posts.user_id`
- `>`: many-to-one. E.g: `posts.user_id > users.id`
- `-`: one-to-one. E.g: `users.id - user_infos.user_id`

### Index Definition (coming soon)

    Table bookings {
      id integer [primary key]
      country varchar
      booking_date date
      created_at timestamp
    
      indexes {
        created_at
        booking_date
        (country, booking_date)
        booking_date [type: 'gin']
      }
    
    }

**Index Settings:**

- `type`: type of index (btree, gin, gist, depending on DB)

### Enum Definition (coming soon)

    Enum UserStatus {
      active [note: "Active user"]
      disabled [note: "Has been disabled by admin"]
      deleted [note: "Soft-deleted"]
    }
    
    Table users {
      id integer [primary key]
      status UserStatus
    }
