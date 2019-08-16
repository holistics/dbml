# DBML - Database Markup Language

DBML (database markup language) is a simple, readable DSL language designed to define database structures.

## Benefits

- It is simple, flexible and highly human-readable
- It is database agnostic, focusing on the essential database structure definition without worrying about the detailed syntaxes of each database
- Comes with a free, simple database visualiser at [dbdiagram.io](http://dbdiagram.io)

## Command-Line Interface (CLI)
**(coming soon)** A `dbml-to-sql` generator to generate SQL from `.dbml` file
- Allow users to integrate DBML with their workflow
- Each project will have one or several `.dbml` files to define database schema
- DBML-CLI will be used to export `.dbml` files to specific SQL (MySQL, PostgreSQL, etc), JSON format, etc
- DBML-CLI could also be used to generate `.dbml` files from other SQL or JSON files

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


### Syntax Consistency
DBML is the standard language for database and the syntax is consistent to provide clear and extensive functions.

- curly brackets `{}`: grouping for indexes, constraints and table definitions
- square brackets `[]`: settings
- forward slashes `//`: comments
- `column_name` is stated in just plain text
- single quote as `'string'`: string value
- double quote as `"column name"`: quoting variable
- backtick `` ` ``: function expression

### Community Contributions

**Emacs Mode for DBML**

(Contributed by ccod): https://github.com/ccod/dbd-mode