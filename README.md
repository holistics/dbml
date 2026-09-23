# DBML - Database Markup Language

<div align="center">

[![Build Status](https://img.shields.io/github/actions/workflow/status/holistics/dbml/test.yml?label=CI&logo=github&style=flat-square)](https://github.com/holistics/dbml/actions/workflows/test.yml)
[![npm @dbml/core](https://img.shields.io/npm/v/@dbml/core?style=flat-square&label=npm%20@dbml/core)](https://www.npmjs.org/package/@dbml/core)
[![npm @dbml/core downloads](https://img.shields.io/npm/dm/@dbml/core.svg?style=flat-square)](https://npm-stat.com/charts.html?package=@dbml/core)
[![npm @dbml/cli](https://img.shields.io/npm/v/@dbml/cli?style=flat-square&label=npm%20@dbml/cli)](https://www.npmjs.org/package/@dbml/cli)
[![npm @dbml/cli downloads](https://img.shields.io/npm/dm/@dbml/cli.svg?style=flat-square)](https://npm-stat.com/charts.html?package=@dbml/cli)

</div>
DBML (database markup language) is a simple, readable DSL language designed to define database structures.

For more information, please check out [DBML homepage](https://dbml.dbdiagram.io)

## Benefits

- It is simple, flexible and highly human-readable
- It is database agnostic, focusing on the essential database structure definition without worrying about the detailed syntaxes of each database
- Comes with a free, simple database visualiser at [dbdiagram.io](https://dbdiagram.io)
- Also comes with a free database documentation app at [dbdocs.io](https://dbdocs.io)

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

## Community Contributions

The community maintains DBML parsers, editor plugins and schema generators across many
languages. See the full, categorised list on the
[DBML Ecosystem page](https://dbml.dbdiagram.io/ecosystem).

Built something that reads or writes DBML? Add it to
[`dbml-homepage/src/data/ecosystem.ts`](dbml-homepage/src/data/ecosystem.ts) and open a pull
request.
