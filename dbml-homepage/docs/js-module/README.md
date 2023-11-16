# JS Module

## core

[![NPM](https://img.shields.io/npm/v/@dbml/core)](https://www.npmjs.com/package/@dbml/core)

A core package that is responsible for parsing and converting between different formats

* Parse DBML and SQL to `Database` object
* Export SQL and DBML from `Database` object
* Convert DBML to SQL and SQL to DBML

### Installation
```bash
npm install @dbml/core
# or
yarn add @dbml/core
```

### API

#### importer
```javascript
const { importer } = require('@dbml/core');
```

##### importer.import( str, format )

* **Arguments:**  
  * ```{string} str```
  * ```{'mysql'|'postgres'|'postgresLegacy'|'dbml'|'schemarb'|'mssql'|'json'} format```

* **Returns:** 
  * ```{string} DBML```

* **Usage:**  
Generate DBML from SQL.

Note: The `postgresLegacy` option import postgreSQL to dbml using the old parser. It's quicker but less accurate.

```javascript
const fs = require('fs');
const { importer } = require('@dbml/core');

// read PostgreSQL file script
const postgreSQL = fs.readFileSync('./schema.sql', 'utf-8');

// generate DBML from PostgreSQL script
const dbml = importer.import(postgreSQL, 'postgres');

```

#### exporter
```javascript
const { exporter } = require('@dbml/core');
```

##### exporter.export( str, format )

* **Arguments:**  
  * ```{string} str```
  * ```{'mysql'|'postgres'|'dbml'|'schemarb'|'mssql'|'json'} format```

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

#### Class: Parser

```javascript
const { Parser } = require('@dbml/core');
```

##### Parser.parse( str, format )
* **Arguments:**  
  * ```{string} str```
  * ```{'mysql'|'postgres'|'postgresLegacy'|'dbml'|'schemarb'|'mssql'|'json'|'dbmlv2'} format```

* **Returns:** ```Database``` object

* **Usage:**  
Parse specified format to ```Database``` object

Note: The `postgresLegacy` option parse postgreSQL using the old parser. It's quicker but less accurate.

```javascript
const fs = require('fs');
const { Parser } = require('@dbml/core');

// get DBML file content
const dbml = fs.readFileSync('./schema.dbml', 'utf-8');

// parse DBML to Database object
const database = (new Parser()).parse(dbml, 'dbml');
```

#### Class: ModelExporter

```javascript
const { ModelExporter } = require('@dbml/core');
```

##### ModelExporter.export( model, format, isNormalized = true )

* **Arguments:**  
  * ```{model} Database```
  * ```{'mysql'|'postgres'|'dbml'|'schemarb'|'mssql'|'json'} format```
  * ```{boolean} isNormalized```

* **Returns:** specified format string

* **Usage:**  
Export ```Database``` object to specified format

```javascript
const { ModelExporter } = require('@dbml/core');

// get DBML file content
const dbml = fs.readFileSync('./schema.dbml', 'utf-8');

// parse DBML to Database object
const database = (new Parser()).parse(dbml, 'dbml');

// Export Database object to PostgreSQL
const postgreSQL = ModelExporter.export(database, 'postgres', false);
// or
const postgreSQL = ModelExporter.export(database.normalize(), 'postgres');
```