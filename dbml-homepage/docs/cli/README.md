# CLI
DBML comes with a built-in CLI which can be used to convert between different formats from
the command line  

![img](./cli.gif)
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
           [--mysql|--postgres]
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
           [--mysql|--postgres]
           [-o|--out-file <output-filepath>]
```