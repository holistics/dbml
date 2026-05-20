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

### Parser

```javascript
const { Parser } = require('@dbml/core');

const parser = new Parser();
```

Regarding DBML parsing, `Parser` supports two styles:

- **Stateless single-file API** (`parser.parse`): Accepts a string and a format, returns a `Database` as a result of parsing that string according to the specified format. This API is good for ad-hoc, one-off parsing.
- **Stateful multifile API** (`parser.setDbmlSource` and `parser.parseDbmlProject`): Register files into the parser, then specify the entrypoint file to start parsing. Results are cached and incrementally updated, making it more performant for repeated or editor-driven use cases.

#### `parser.parse(str, format)`

* **Arguments:**
  * ```{string} str```
  * ```{'mysql'|'mysqlLegacy'|'postgres'|'postgresLegacy'|'dbml'|'schemarb'|'mssql'|'mssqlLegacy'|'snowflake'|'json'|'dbmlv2'|'oracle'} format```

* **Returns:** ```Database``` object

* **Usage:**
Parse a single-file input in the specified format to ```Database``` object. For multifile DBML projects, use `parser.setDbmlSource` and `parser.parseDbmlProject` instead.

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
  * ```{string} filepath``` — an absolute file path (e.g. `'/main.dbml'`)
  * ```{string} source``` — file content

* **Usage:**
Register a DBML source file for multifile parsing.

```javascript
const fs = require('fs');
const path = require('path');
const { Parser } = require('@dbml/core');

const parser = new Parser();
const projectDir = '/path/to/project';

// Load DBML files from disk into the parser
for (const file of fs.readdirSync(projectDir).filter(f => f.endsWith('.dbml'))) {
  const fullPath = path.join(projectDir, file);
  parser.setDbmlSource(fullPath, fs.readFileSync(fullPath, 'utf-8'));
}
```

#### `parser.getDbmlSource(filepath)`

* **Arguments:**
  * ```{string} filepath``` — an absolute file path (e.g. `'/main.dbml'`)

* **Returns:** ```string | undefined``` — the file content, or `undefined` if the file does not exist.

* **Usage:**
Read the content of a registered DBML file.

```javascript
const { Parser } = require('@dbml/core');

const parser = new Parser();

parser.setDbmlSource('/main.dbml', 'Table posts { id integer [pk] }');

parser.getDbmlSource('/main.dbml');  // 'Table posts { id integer [pk] }'
parser.getDbmlSource('/other.dbml'); // undefined
```

#### `parser.deleteDbmlSource(filepath)`

* **Arguments:**
  * ```{string} filepath``` — an absolute file path (e.g. `'/main.dbml'`)

* **Usage:**
Remove a single DBML source file from the parser.

```javascript
const { Parser } = require('@dbml/core');

const parser = new Parser();
parser.setDbmlSource('/main.dbml', 'Table posts { id integer [pk] }');
parser.setDbmlSource('/users.dbml', 'Table users { id integer [pk] }');

parser.deleteDbmlSource('/users.dbml');
parser.getDbmlSource('/users.dbml'); // undefined
parser.getDbmlSource('/main.dbml');  // 'Table posts { id integer [pk] }'
```

#### `parser.clearDbmlSource()`

* **Usage:**
Remove all registered DBML source files from the parser.

```javascript
const { Parser } = require('@dbml/core');

const parser = new Parser();
parser.setDbmlSource('/main.dbml', 'Table posts { id integer [pk] }');
parser.setDbmlSource('/users.dbml', 'Table users { id integer [pk] }');

parser.clearDbmlSource();
parser.getDbmlSource('/main.dbml');  // undefined
parser.getDbmlSource('/users.dbml'); // undefined
```

#### `parser.parseDbmlProject(entrypoint)`

* **Arguments:**
  * ```{string} entrypoint``` — absolute path to the entry file

* **Returns:** ```Database``` object

* **Throws:** ```CompilerError``` on syntax or binding errors

* **Usage:**
Parse a file (specified by entrypoint) in a multifile project, including all used files.

```javascript
const fs = require('fs');
const path = require('path');
const { Parser } = require('@dbml/core');

const parser = new Parser();
const projectDir = '/path/to/project';

// Load all .dbml files from the project directory
for (const file of fs.readdirSync(projectDir).filter(f => f.endsWith('.dbml'))) {
  const fullPath = path.join(projectDir, file);
  parser.setDbmlSource(fullPath, fs.readFileSync(fullPath, 'utf-8'));
}

// Parse starting from the main entry file
const database = parser.parseDbmlProject(path.join(projectDir, 'main.dbml'));
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
