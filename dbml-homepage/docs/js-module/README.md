# JS Module

## core

A core package that is responsible for parsing and converting between different formats

* Parse DBML and SQL to `Schema` Object
* Export SQL and DBML from `Schema` Object
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
  * ```{'mysql'|'postgres'} format```

* **Returns:** 
  * ```{string} DBML```

* **Usage:**  
Generate DBML from SQL

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
  * ```{'mysql'|'postgres'} format```

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
const parser = new Parser();
```

##### parser.parse( str, format )
* **Arguments:**  
  * ```{string} str```
  * ```{'mysql'|'postgres'|'dbml'} format```

* **Returns:** ```Schema``` Object

* **Usage:**  
Parse specified format to ```Schema``` Object

```javascript
const fs = require('fs');
const { Parser } = require('@dbml/core');

// get DBML file content
const dbml = fs.readFileSync('./schema.dbml', 'utf-8');

const parser = new Parser();

// parse DBML to Schema object
const schema = parser.parse(dbml, 'dbml');
```

#### Class: SchemaExporter

```javascript
const { SchemaExporter } = require('@dbml/core');
const schemaExporter = new SchemaExporter(schema);
```

##### new SchemaExporter( schema )

* **Arguments:**  
  * ```{Object} schema```

* **Usage:**  
Create a new SchemaExporter instance with a `Schema` Object

##### schemaExporter.export( format )

* **Arguments:**  
  * ```{'mysql'|'postgres'|'dbml'} format```

* **Returns:** specified format string

* **Usage:**  
Export ```Schema``` Object to specified format

```javascript
const { SchemaExporter } = require('@dbml/core');

const schemaExporter = new SchemaExporter(schema);

// Export Schema object to PostgreSQL
const postgreSQL = schemaExporter.export('postgres');
```