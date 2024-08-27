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

#### `importer.import(str, format)`

* **Arguments:**
  * ```{string} str```
  * ```{'mysql'|'mysqlLegacy'|'postgres'|'postgresLegacy'|'dbml'|'schemarb'|'mssql'|'snowflake'|'json'} format```

* **Returns:**
  * ```{string} DBML```

* **Usage:**
Generate DBML from SQL.

:::note
The `postgresLegacy` and `mysqlLegacy` options import PostgreSQL/MySQL to dbml using the old parsers. It's quicker but less accurate.
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

#### `exporter.export(str, format)`

* **Arguments:**
  * ```{string} str```
  * ```{'mysql'|'postgres'|'oracle'|'dbml'|'schemarb'|'mssql'|'json'} format```

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

#### `parser.parse(str, format)`

* **Arguments:**
  * ```{string} str```
  * ```{'mysql'|'mysqlLegacy'|'postgres'|'postgresLegacy'|'dbml'|'schemarb'|'mssql'|'snowflake'|'json'|'dbmlv2'} format```

* **Returns:** ```Database``` object

* **Usage:**
Parse specified format to ```Database``` object

:::note

* The `postgresLegacy` and `mysqlLegacy` options import PostgreSQL/MySQL to dbml using the old parsers. It's quicker but less accurate.

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

### ModelExporter

```javascript
const { ModelExporter } = require('@dbml/core');
```

#### `ModelExporter.export(model, format, isNormalized)`

* **Arguments:**
  * ```{model} Database```
  * ```{'mysql'|'postgres'|'oracle'|'dbml'|'schemarb'|'mssql'|'json'} format```
  * ```{boolean} isNormalized```

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
const postgreSQL = ModelExporter.export(database, 'postgres', false);
// or
const postgreSQL = ModelExporter.export(database.normalize(), 'postgres');
```
