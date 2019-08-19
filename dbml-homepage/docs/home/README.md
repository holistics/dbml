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
* Comes with a free, simple database visualiser at [dbdiagram.io](https://dbdiagram.io)

## DBML Syntax

For full DBML syntax documentation, refer to the [Docs](/docs/) section.

## Is this similar to SQL DDL?

Not quite. Despite its name (data "definition" language), DDL is designed mainly to help physically create, modify or
remove tables, not to define them. In other words, **DDL is imperative, while DBML is declarative**. This makes DBML
 so much easier to write, read and maintain.

DDL is also database specific (Oracle, PostgreSQL, etc), while DBML is designed to focus on the high-level database
 design stage instead of low-level database creation stage.

## What can I do now?

At the moment, DBML is primarily used by dbdiagram.io, a tool we built to design and visualize
 database diagram.

1. Go to [dbdiagram.io](https://dbdiagram.io)
2. Type up your DBML code
3. Go to Export > SQL (choose your DB)

Concurrently, we're actively working on open-sourcing DBML to support more use cases. The plan is to provide a command-line tool and NPM
package so that you can do that programmatically.


## How DBML was born

DBML was born out from [dbdiagram.io](https://dbdiagram.io), a simple database diagram visualizer. At the time (Aug 2018) we were looking for
 a simple tool to design database structure but couldn't come up with one we liked. So we decided to build one.

After that, we then realized the syntax we designed for users to draw diagram is well received, and thought this could
 become a good standardized way to document database structures as well. That's how DBML is born.

![img](https://i.imgur.com/8T1tIZp.gif)

## DBML Statistics

* 110k Diagrams created on dbdiagram.io using DBML (as of July 2019)
* 59.5k Users using DBML (as of July 2019)

## Community

* DBML is [being open-sourced on Github](https://github.com/holistics/dbml/)
* Have a question or suggestion, use [the dbml community forum](https://community.dbdiagram.io/)

## Community Contributions

* [Emacs Mode for DBML by ccod](https://github.com/ccod/dbd-mode)
