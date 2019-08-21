# DBML - Database Markup Language

## Intro

**DBML (Database Markup Language)** is a simple DSL language designed to define and document database schemas and structures.
It is designed to be simple, highly readable and database-agnostic.


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


**Benefits:**

* It is simple, flexible and highly human-readable
* It is database agnostic, focusing on the essential database structure definition without worrying about the detailed syntaxes of each database

## DBML Syntax

For full DBML syntax documentation, refer to the [Docs](/docs/) section.

## Is this similar to SQL DDL?

Not quite. Despite its name (data "definition" language), DDL is designed mainly to help physically create, modify or
remove tables, not to define them. In other words, **DDL is imperative, while DBML is declarative**. This makes DBML
 so much easier to write, read and maintain.

DDL is also database specific (Oracle, PostgreSQL, etc), while DBML is database-agnostic and designed to focus on the high-level database design stage instead of low-level database creation stage.

## What can I do now?

DBML comes with:
1. A command-line tool to help to convert SQL to DBML files and vice versa.
1. A free, simple database visualiser at [dbdiagram.io](https://dbdiagram.io)

### Command-line Tool (CLI)

A simple command-line tool to help you convert between SQL (DDL) and DBML.

![img](../cli/cli.gif)

To learn more, check out [CLI docs](/cli)

### dbdiagram

dbdiagram.io is a tool to help you design and visualize database diagram.

![img](https://i.imgur.com/8T1tIZp.gif)

1. Go to [dbdiagram.io](https://dbdiagram.io)
2. Type up your DBML code
3. Go to Export -> SQL

## How DBML was born

DBML was born out from [dbdiagram.io](https://dbdiagram.io), a simple database diagram visualizer. At the time (Aug 2018) we were looking for a simple tool to design database structure but couldn't come up with one we liked. So we decided to build one.

After 1 year and over 100k diagrams created by 60k internet users later, we then realized the syntax we designed for users to draw diagram is well received, and thought this could become a good standardized way to document database structures as well. That's how DBML is born.

## DBML Statistics

* 110k Diagrams created on dbdiagram.io using DBML (as of July 2019)
* 59.5k Users using DBML (as of July 2019)

## Community

* DBML is [being open-sourced on Github](https://github.com/holistics/dbml/)
* Have a question, suggestion or want to contribute? Use [the dbml issues page](https://github.com/holistics/dbml/issues)

## Community Contributions

* [Emacs Mode for DBML by ccod](https://github.com/ccod/dbd-mode)
