---
title: '@dbml/core'
---

[![NPM](https://img.shields.io/npm/v/@dbml/core)](https://www.npmjs.com/package/@dbml/core)

This is a core package that is responsible for parsing and converting between different formats:

* Parse DBML and SQL to `Database` object
* Export SQL and DBML from `Database` object
* Convert DBML to SQL and SQL to DBML
* Generate DBML from `DatabaseSchema` object

## Installation

```bash npm2yarn
npm install @dbml/core
```

## APIs

### importer

```javascript
const { importer } = require('@dbml/core');
```

#### `importer.import(str, format[, options])`

* **Arguments:**
  * ```{string} str```
  * ```{'mysql'|'mysqlLegacy'|'postgres'|'postgresLegacy'|'dbml'|'schemarb'|'mssql'|'mssqlLegacy'|'snowflake'|'json'|'oracle'} format```
  * ```{ImportOptions} options``` *(optional)*
    * `includeRecords` `{boolean}` — whether to include `Records` blocks in the output DBML. Defaults to `true`.

* **Returns:**
  * ```{string} DBML```

* **Usage:**
Generate DBML from SQL.

:::note
The `postgresLegacy`, `mysqlLegacy` and `mssqlLegacy` options import PostgreSQL/MySQL/MSSQL to dbml using the old parsers. It's quicker but less accurate.
:::

```javascript
const fs = require('fs');
const { importer } = require('@dbml/core');

// read PostgreSQL file script
const postgreSQL = fs.readFileSync('./schema.sql', 'utf-8');

// generate DBML from PostgreSQL script
const dbml = importer.import(postgreSQL, 'postgres');
```

#### `importer.generateDbml(schemaJson)`

* **Arguments:**
  * ```{DatabaseSchema} schemaJson```

* **Returns:**
  * ```{string} DBML```

* **Usage:**
Generate DBML from a `DatabaseSchema` object.

The following example use the [@dbml/connector](./connector.md) to get the `DatabaseSchema` object.

```javascript
const { importer } = require('@dbml/core');
const { connector } = require('@dbml/connector');

// Use the dbml connector to get the DatabaseSchema object
const connection = 'postgresql://dbml_user:dbml_pass@localhost:5432/dbname?schemas=public';
const databaseType = 'postgres';

const schemaJson = await connector.fetchSchemaJson(connection, databaseType);

// Generate DBML from the DatabaseSchema object
const dbml = importer.generateDbml(schemaJson);
```

### exporter

```javascript
const { exporter } = require('@dbml/core');
```

#### `exporter.export(str, format[, options])`

* **Arguments:**
  * ```{string} str```
  * ```{'mysql'|'postgres'|'oracle'|'dbml'|'mssql'|'json'} format```
  * ```{ExportOptions} options``` *(optional)*
    * `includeRecords` `{boolean}` — whether to include `Records` blocks in the DBML output. Defaults to `true`. Only applies to the `dbml` format.
    * `isNormalized` `{boolean}` — whether the model is already normalized. Defaults to `true`. Only applies to the `json` format.

* **Returns:**
  * ```{string} SQL```

* **Usage:**
Export DBML to SQL

```javascript
const fs = require('fs');
const { exporter } = require('@dbml/core');

// get DBML file content
const dbml = fs.readFileSync('./schema.dbml', 'utf-8');

// generate MySQL from DBML
const mysql = exporter.export(dbml, 'mysql');
```

### Filepath

```javascript
const { Filepath } = require('@dbml/core');
```

#### `Filepath.from(absolutePath)`

* **Arguments:**
  * ```{string} absolutePath``` — an absolute file path (e.g. `'/main.dbml'`)

* **Returns:** ```Filepath``` object

* **Usage:**
Create a `Filepath` reference for use with `parser.dbmlProjectLayout` and `parser.parseDbmlProject`.

```javascript
const entry = Filepath.from('/main.dbml');
```

#### `filepath.absolute`

* **Type:** ```string```

* **Usage:**
Returns the absolute path string of the filepath.

#### `filepath.resolve(relativePath)`

* **Arguments:**
  * ```{string} relativePath```

* **Returns:** ```Filepath``` object

* **Usage:**
Resolve a relative path against this filepath's directory.

#### `filepath.relativeTo(baseDir)`

* **Arguments:**
  * ```{string} baseDir```

* **Returns:** ```string```

* **Usage:**
Returns the relative path from `baseDir` to this filepath.

### Parser

```javascript
const { Parser } = require('@dbml/core');

const parser = new Parser();
```

Regarding DBML parsing, `Parser` supports two styles:

- **Stateless single-file API** (`parser.parse`) — takes a string and format, returns a `Database`. Good for ad-hoc, one-off parsing.
- **Stateful multifile API** (`parser.setDbmlSource` and `parser.parseDbmlProject`) — register files into the parser, then parse by entrypoint. Results are cached and incrementally updated, making it more performant for repeated or editor-driven use cases.

#### `parser.parse(str, format)`

* **Arguments:**
  * ```{string} str```
  * ```{'mysql'|'mysqlLegacy'|'postgres'|'postgresLegacy'|'dbml'|'schemarb'|'mssql'|'mssqlLegacy'|'snowflake'|'json'|'dbmlv2'|'oracle'} format```

* **Returns:** ```Database``` object

* **Usage:**
Parse a single-file input in the specified format to ```Database``` object. For multifile DBML projects, use `parser.setDbmlSource` and `parseDbmlProject` instead.

:::note

* The `postgresLegacy`, `mysqlLegacy` and `mssqlLegacy` options import PostgreSQL/MySQL/MSSQL to dbml using the old parsers. It's quicker but less accurate.

* The `dbmlv2` option parse dbml using the new parser. It's quicker and more robust to errors/more user-friendly error messages.

:::

```javascript
const fs = require('fs');
const { Parser } = require('@dbml/core');

const parser = new Parser();

// get DBML file content
const dbml = fs.readFileSync('./schema.dbml', 'utf-8');

// parse DBML to Database object
const database = parser.parse(dbml, 'dbml');
```

#### `parser.setDbmlSource(filepath, source)`

* **Arguments:**
  * ```{Filepath} filepath```
  * ```{string|undefined} source``` — file content, or `undefined` to remove the file

* **Usage:**
Register or remove a DBML source file for multifile parsing. Use together with `parseDbmlProject`.

#### `parser.deleteDbmlSource(filepath)`

* **Arguments:**
  * ```{Filepath} filepath```

* **Usage:**
Remove a single DBML source file from the parser.

#### `parser.clearDbmlSource()`

* **Usage:**
Remove all DBML source files from the parser.

#### `parser.parseDbmlProject(entrypoint)`

* **Arguments:**
  * ```{Filepath} entrypoint``` — the entry file to start parsing from

* **Returns:** ```Database``` object

* **Throws:** ```CompilerError``` on syntax or binding errors

* **Usage:**
Parse a file (specified by entrypoint) in a multifile project, including all used files. Use together with `parser.setDbmlSource` to register files before parsing.

```javascript
const { Parser, Filepath } = require('@dbml/core');

const parser = new Parser();

parser.setDbmlSource(Filepath.from('/main.dbml'), `
  use { table users } from './users.dbml'

  Table posts {
    id integer [pk]
    user_id integer [ref: > users.id]
  }
`);

parser.setDbmlSource(Filepath.from('/users.dbml'), `
  Table users {
    id integer [pk]
    name varchar
  }
`);

const database = parser.parseDbmlProject(Filepath.from('/main.dbml'));
```

### ModelExporter

```javascript
const { ModelExporter } = require('@dbml/core');
```

#### `ModelExporter.export(model, format[, options])`

* **Arguments:**
  * ```{Database|NormalizedModel} model```
  * ```{'mysql'|'postgres'|'oracle'|'dbml'|'mssql'|'json'} format```
  * ```{ExportOptions} options``` *(optional)*
    * `includeRecords` `{boolean}` — whether to include `Records` blocks in the DBML output. Defaults to `true`. Only applies to the `dbml` format.
    * `isNormalized` `{boolean}` — whether the passed model is already normalized. Defaults to `true`. Only applies to the `json` format.

:::note
Passing a boolean as the third argument is deprecated. Use `ExportOptions` instead.
:::

* **Returns:** specified format string

* **Usage:**
Export ```Database``` object to specified format

```javascript
const { ModelExporter, Parser } = require('@dbml/core');

// get DBML file content
const dbml = fs.readFileSync('./schema.dbml', 'utf-8');

// parse DBML to Database object
const parser = new Parser();
const database = parser.parse(dbml, 'dbml');

// Export Database object to PostgreSQL
const postgreSQL = ModelExporter.export(database, 'postgres');
```
