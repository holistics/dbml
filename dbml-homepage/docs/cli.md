---
title: CLI
---

# CLI

[![NPM](https://img.shields.io/npm/v/@dbml/cli)](https://www.npmjs.com/package/@dbml/cli)

DBML comes with a built-in CLI that enables conversion/generation between various formats from the command line.

![img](/img/dbml-cli.gif)

## Prerequisites

Before you begin, ensure you have met the following requirements:

- **Node.js**: From `@dbml/cli@3.7.1`, you need to have Node.js version 18.0.0 or higher installed.

## Installation

```bash
npm install -g @dbml/cli

# or if you're using yarn
yarn global add @dbml/cli
```

## Convert a DBML file to SQL

```bash
$ dbml2sql schema.dbml

CREATE TABLE "staff" (
  "id" INT PRIMARY KEY,
  "name" VARCHAR,
  "age" INT,
  "email" VARCHAR
);
...
```

By default it will generate to "PostgreSQL". To specify which database to generate to:

```bash
$ dbml2sql schema.dbml --mysql

CREATE TABLE `staff` (
  `id` INT PRIMARY KEY,
  `name` VARCHAR(255),
  `age` INT,
  `email` VARCHAR(255)
);
...
```

To **output to a file** you may use `--out-file` or `-o`:

```bash
$ dbml2sql schema.dbml -o schema.sql
  ✔ Generated SQL dump file (PostgreSQL): schema.sql
```

### Syntax Manual

```bash
$ dbml2sql <path-to-dbml-file>
           [--mysql|--postgres|--mssql|--oracle]
           [-o|--out-file <output-filepath>]
```

## Convert  a SQL file to DBML

To convert SQL to DBML file:

```bash
$ sql2dbml dump.sql --postgres

Table staff {
  id int [pk]
  name varchar
  age int
  email varchar
}
...
```

**Output to a file:**

```bash
$ sql2dbml --mysql dump.sql -o mydatabase.dbml
  ✔ Generated DBML file from SQL file (MySQL): mydatabase.dbml
```

### Syntax Manual

```bash
$ sql2dbml <path-to-sql-file>
           [--mysql|--postgres|--mssql|--postgres-legacy|--mysql-legacy|--snowflake]
           [-o|--out-file <output-filepath>]
```

Note: The `--postgres-legacy` and `--mysql-legacy` options import PostgreSQL/MySQL to dbml using the old parsers. It's quicker but less accurate.

## Generate DBML directly from a database

```bash
$ db2dbml postgres postgresql://dbml_user:dbml_pass@localhost:5432/schema

Table "staff" {
  "id" int4 [pk, not null]
  "name" varchar
  "age" int4
  "email" varchar
}
...

```

**Output to a file:**

```bash
$ db2dbml postgres postgresql://dbml_user:dbml_pass@localhost:5432/schema -o schema.dbml
  ✔ Generated DBML file from database's connection: schema.dbml
```

### Syntax Manual

```bash
$ db2dbml postgres|mysql|mssql
          <connection-string>
          [-o|--out-file <output-filepath>]
```

Connection string examples:

- postgres: `postgresql://user:password@localhost:5432/dbname`
- mysql: `mysql://user:password@localhost:3306/dbname`
- mssql: `'Server=localhost,1433;Database=master;User Id=sa;Password=your_password;Encrypt=true;TrustServerCertificate=true;'`
