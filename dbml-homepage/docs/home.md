---
title: Home
---

# DBML - Database Markup Language

<div style={{ display: "flex", alignItems: "center" }}>
  <p style={{ fontSize: "0.75rem", marginBottom: "0px" }}>Open source</p>
  <a
    href="https://github.com/holistics/dbml"
    target="_blank"
    style={{ marginLeft: "10px", display: "flex", alignItems: "center" }}
  >
    <img
      alt="GitHub Repo stars"
      src="https://img.shields.io/github/stars/holistics/dbml?style=social"
    ></img>
  </a>
</div>

## Intro

**DBML (Database Markup Language)** is an open-source DSL language designed to define and document database schemas and structures. It is designed to be simple, consistent and highly-readable.

It also comes with command-line tool and open-source module to help you convert between DBML and SQL.

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
  status post_status
  created_at timestamp
}

Enum post_status {
  draft
  published
  private [note: 'visible via URL only']
}

Ref: posts.user_id > users.id // many-to-one
```

_See the above dbml doc visualized on [dbdiagram](https://dbdiagram.io/d/e-commerce-database-schema-6320585c0911f91ba59a41d4) and [dbdocs](https://dbdocs.io/Holistics/Ecommerce)_

For full DBML syntax documentation, refer to the [Syntax](/docs) section.

_Note: DBML is not to be confused with Microsoft's DBML file extension (XML format)._

## Benefits

DBML is born to solve the frustrations of developers working on large, complex software projects:

* Difficulty building up a mental "big picture" of an entire project's database structure.
* Trouble understanding tables and what their fields mean, and which feature are they related to.
* The existing ER diagram and/or SQL DDL code is poorly written and hard to read (and usually outdated).

Our recommended best practices is to have a `database.dbml` file in your root repository
_(similar to other config and/or boilerplate files, eg. `packages.json` or `README.md`)_

```text
.
|_ ...
|_ database.dbml
|_ README.md
```

## Is this similar to SQL DDL?

Not quite. Despite its name (data "definition" language), DDL is designed mainly
to help physically create, modify or remove tables, not to define them. In other
words, **DDL is imperative, while DBML is declarative**. This makes DBML so much
easier to write, read and maintain.

DDL is also database specific (Oracle, PostgreSQL, etc), while **DBML is
database-agnostic** and designed for the high-level database architecting
instead of low-level database creation.

## What can I do now?

DBML comes with:

1. A free database visualiser at [dbdiagram.io](https://dbdiagram.io?utm_source=dbml).
2. A free database documentation builder at [dbdocs.io](https://dbdocs.io?utm_source=dbml).
3. A free SQL playground at [runsql.com](https://runsql.com?utm_source=dbml).
4. A command-line tool to help to convert SQL to DBML files and vice versa.
5. An [open-source JS library](/js-module/core) (NPM package) for you to programmatically convert between DBML and SQL DDL.

### dbdiagram

[dbdiagram.io](https://dbdiagram.io?utm_source=dbml) is a free tool to help you visualize database diagrams from DBML code.

![img](https://i.imgur.com/8T1tIZp.gif)

### dbdocs

[dbdocs.io](https://dbdocs.io?utm_source=dbml) is a free tool to help you build database documents from DBML code.

<video width="100%" height="auto" controls autoPlay muted loop>
  <source src="https://cdn.holistics.io/dbdocs/dbdocs-tour.mp4" type="video/mp4"></source>
</video>

### RunSQL

[runsql.com](https://runsql.com?utm_source=dbml) is a free & simple tool to create mock database environments to validate your SQL queries.

<video width="100%" height="auto" controls autoPlay muted loop>
  <source src="https://runsql.com/assets/hero-video-DsrQvnnA.webm" type="video/mp4"></source>
</video>

### Command-line Tool (CLI)

A simple command-line tool to help you convert between SQL (DDL) and DBML. Refer to [CLI docs](/cli) for more info.

![img](/img/dbml-cli.gif)

## DBML History

DBML was born out from [dbdiagram.io](https://dbdiagram.io?utm_source=dbml), a simple database diagram visualizer. At the time (Aug 2018) we were looking for a simple tool to design database structure but couldn't come up with one we liked. So we decided to build one.

After 1 year and over 100k diagrams created by 60k internet users later, we realized the syntax we designed for users to draw diagram is very received and one of the key values of the tool. That's how DBML is born. Our aim is to make DBML a good and simple way for developers to design and document database structures.

## DBML Statistics

* 2.5M DBML docs created via dbdiagram.io and dbdocs.io (as of Feb 2025).
* 1.4M users using DBML (as of Feb 2025).

## Who's behind DBML?

DBML is created and maintained by [Holistics](https://holistics.io?utm_source=dbml), an analytics platform company.

## Community

* DBML is [being open-sourced on Github](https://github.com/holistics/dbml/).
* Have a question, suggestion or want to contribute? Use [the dbml issues page](https://github.com/holistics/dbml/issues).

## Community Contributions

* [Emacs Mode for DBML by ccod](https://github.com/ccod/dbd-mode)
* [Vim Plugin for DBML by jidn](https://github.com/jidn/vim-dbml)
* [VSCode Plugin for DBML by duynvu](https://marketplace.visualstudio.com/items?itemName=duynvu.dbml-language)
* [Python parser for DBML by Vanderhoof](https://github.com/Vanderhoof/PyDBML)
* [FloorPlan: Android's Room to DBML by julioz](https://github.com/julioz/FloorPlan)
* [Go parser for DBML by duythinht](https://github.com/duythinht/dbml-go)
* [DbmlForDjango: Converter between Django models.py and DBML](https://github.com/hamedsj/DbmlForDjango)
* [parseServerSchema2dbml: Converter between ParseServer MongoDB \_SCHEMA collection and DBML by stepanic](https://github.com/stepanic/parse-server-SCHEMA-to-DBML)
* [dbml-renderer: A DBML CLI renderer](https://github.com/softwaretechnik-berlin/dbml-renderer)
* [dbml-parser: A DBML parser written on PHP8 by Butschster](https://github.com/butschster/dbml-parser)
* [Kacher: Laravel's Database Schemas to DBML by Arsanandha Aphisitworachorch](https://github.com/aphisitworachorch/kacher)
* [d365fo-entity-schema: Generate DBML from Dynamics 365 Finance and Operations](https://github.com/noakesey/d365fo-entity-schema)
* [Treesitter for DBML](https://github.com/dynamotn/tree-sitter-dbml)
* [DB2Code: Generate DBML from Maven](https://github.com/alberlau/DB2Code)
* [dbml-java: A DBML parser written on Java 17 by Nils Wende](https://github.com/nilswende/dbml-java)
* [SchemaToDbml: A gem that generates DBML from Rails schema.rb by Ricardo Ribeiro](https://github.com/ricardojcribeiro/schema_to_dbml)
* [Snowflake DBML Generator by Ryan Rozich](https://github.com/ryanrozich/snowflake-dbml-generator)
* [prisma-dbml-generator: Generate DBML schema from Prisma Schema by Marc Stammerjohann](https://github.com/notiz-dev/prisma-dbml-generator)
* [C# parser for Dbml by Niels Bosma](https://github.com/Ivy-Interactive/Ivy.Dbml.Parser)
* [Scafoldr: DBML-Powered Code Scaffolding Tool](https://scafoldr.com/code-generator)
