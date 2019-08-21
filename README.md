# DBML - Database Markup Language

DBML (database markup language) is a simple, readable DSL language designed to define database structures.

For more information, please check out [DBML homepage](https://dbml-lang.org)

## Benefits

- It is simple, flexible and highly human-readable
- It is database agnostic, focusing on the essential database structure definition without worrying about the detailed syntaxes of each database
- Comes with a free, simple database visualiser at [dbdiagram.io](http://dbdiagram.io)

## Example

Example of a database definition of a simple blogging site:

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

## Is this similar to SQL DDL?

Not quite. Despite its name (data "definition" language), DDL is designed mainly to help physically create, modify or remove tables, not to define them.

**DDL also comes with a few more drawbacks:**

- It is hard to read, especially when trying to add multiple column/table settings together.
- It is database specific (Oracle vs PostgreSQL vs MySQL, etc)
- Since it is imperative (vs declarative), to fully reconstruct a table definition you have to trace through all the code (instead of focusing on just 1 single section).

## How to generate SQL from DBML?

1. Go to dbdiagram.io
2. Type up your DBML code
3. Go to Export > SQL (choose your DB)

## DBML Full Syntax Docs

Please refer to the [docs section](https://dbml-lang.org/docs) on the website.


### Community Contributions

* Emacs Mode for DBML (Contributed by ccod): https://github.com/ccod/dbd-mode
