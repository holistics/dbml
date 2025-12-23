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
  * ```{'mysql'|'mysqlLegacy'|'postgres'|'postgresLegacy'|'dbml'|'schemarb'|'mssql'|'mssqlLegacy'|'snowflake'|'json'|'oracle'} format```

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
  * ```{'mysql'|'mysqlLegacy'|'postgres'|'postgresLegacy'|'dbml'|'schemarb'|'mssql'|'mssqlLegacy'|'snowflake'|'json'|'dbmlv2'|'oracle'} format```

* **Returns:** ```Database``` object

* **Usage:**
Parse specified format to ```Database``` object

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

## SQL Parser Feature Support

This section documents the SQL parsing capabilities for each supported database when importing SQL to DBML.

### Support Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Fully supported and correctly parsed |
| ◐ | Valid SQL that is parsed, but some options/clauses are ignored |
| ✗ | Valid SQL syntax, but the parser fails to generate output |
| — | Syntax not valid for this database |

### `CREATE TABLE`

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Basic syntax | ✓ | ✓ | ✓ | ✓ | ✓ |
| Parameterized types (e.g., `VARCHAR(255)`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Array types (e.g., `INTEGER[]`) | ✓ | — | — | — | — |
| Enumerated types (`ENUM`) | ✓ | ✓ | — | — | — |
| Temporary tables | ◐ | ✗ | ✓ | ◐ | ◐ |
| `CREATE TABLE` AS SELECT | ✗ | ✗ | ✗ | ✗ | ✗ |
| Table options (`ENGINE`, `TABLESPACE`, etc.) | ◐ | ◐ | ◐ | ◐ | ◐ |
| Other column properties (`COLLATE`, etc.) | ◐ | ✗ | ◐ | ◐ | ◐ |
| Generated/Computed columns | ◐ | ◐ | ◐ | ◐ | ◐ |

**Notes:**
- **MSSQL**:
  - Temporary tables use `#` prefix (local) and `##` prefix (global)
  - Square bracket identifiers (`[identifier]`) are supported

#### `PRIMARY KEY`

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Column-level | ✓ | ✓ | ✓ | ✓ | ✓ |
| Table-level | ✓ | ✓ | ✓ | ✓ | ✓ |
| Multi-column | ✓ | ✓ | ✓ | ✓ | ✓ |
| Explicitly named (`CONSTRAINT name`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| CLUSTERED/NONCLUSTERED | — | — | ◐ | — | — |

#### `FOREIGN KEY`

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Column-level (`REFERENCES`) | ✓ | ✓ | ✗ | ✓ | ✗ |
| Table-level | ✓ | ✓ | ✓ | ✓ | ✗ |
| Multi-column | ✓ | ✓ | ✓ | ✓ | ✗ |
| Explicitly named (`CONSTRAINT name`) | ✓ | ✓ | ✓ | ✓ | ✗ |
| `ON UPDATE` action | ✓ | ✓ | ✓ | — | ✗ |
| `ON DELETE` action | ✓ | ✓ | ✓ | ✓ | ✗ |

**Notes:**
- **MSSQL**: Column-level `FOREIGN KEY` has a known bug - use table-level syntax instead
- **Snowflake**: All `FOREIGN KEY` definitions have a known bug producing undefined errors

#### `UNIQUE`

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Column-level | ✓ | ✓ | ✓ | ✓ | ✓ |
| Table-level | ✓ | ✓ | ✓ | ✓ | ✓ |
| Multi-column | ✓ | ✓ | ✓ | ✓ | ✓ |
| Explicitly named (`CONSTRAINT name`) | ✓ | ✓ | ◐ | ✓ | ◐ |
| `UNIQUE KEY`/`UNIQUE INDEX` syntax | — | ✓ | — | — | — |

#### `CHECK`

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Column-level | ✓ | ✓ | ✓ | ✓ | ✗ |
| Table-level | ✓ | ✓ | ✓ | ✓ | ✗ |
| Explicitly named (`CONSTRAINT name`) | ✓ | ✓ | ✓ | ✓ | ✗ |

#### `DEFAULT`

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Column-level | ✓ | ✓ | ✓ | ✓ | ✓ |
| Function as default | ✓ | ✓ | ✓ | ✓ | ✓ |
| Explicitly named (`CONSTRAINT name`) | — | — | ◐ | — | ◐ |

#### `NOT NULL`

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Column-level `NOT NULL` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Explicit column-level `NULL` | ✓ | ✓ | ✓ | ✓ | ✓ |

#### Auto-Increment Columns

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| `SERIAL` (pseudo-type) | ✓ | — | — | — | — |
| `BIGSERIAL` (pseudo-type) | ✓ | — | — | — | — |
| `AUTO_INCREMENT` (column attribute) | — | ✓ | — | — | — |
| `IDENTITY(seed, increment)` (column property) | — | — | ✓ | — | ✓ |
| `GENERATED AS IDENTITY` (column property) | ✓ | — | ✗ | ✓ | ✗ |
| `GENERATED ALWAYS AS IDENTITY` | ✓ | — | — | ✓ | — |
| `GENERATED BY DEFAULT AS IDENTITY` | ✓ | — | — | ✓ | — |

#### Inline Indexes

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Column-level indexes | — | ✗ | — | — | — |
| Table-level `INDEX`/`KEY` | — | ✓ | — | ✓ | — |
| Named indexes | — | ✓ | — | ✓ | — |
| Multi-column indexes | — | ✓ | — | ✓ | — |
| USING BTREE/HASH | — | ✓ | — | — | — |
| FULLTEXT/SPATIAL | — | ◐ | — | — | — |

---

### `CREATE INDEX`

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Basic `CREATE INDEX` | ✓ | ✓ | ✓ | ✓ | — |
| Multi-column index | ✓ | ✓ | ✓ | ✓ | — |
| `UNIQUE` index | ✓ | ✓ | ✓ | ✓ | — |
| Function-based index | ✓ | ✓ | — | ✓ | — |
| BTREE | ✓ | ✓ | ✗ | — | — |
| HASH | ✓ | ✓ | — | — | — |
| GIST | ✓ | — | — | — | — |
| BRIN | ✓ | — | — | — | — |
| GIN | ✓ | — | — | — | — |
| Partial/Filtered index (`WHERE`) | ◐ | ✗ | ◐ | ◐ | — |
| FULLTEXT | — | ◐ | ✗ | — | — |
| SPATIAL | — | ◐ | ✗ | — | — |

**Notes:**
- **MSSQL**: Function-based indexes use computed columns instead

---

### `INSERT` Statements

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Basic `INSERT` ... VALUES | ✓ | ✓ | ✓ | ✓ | ✗ |
| Multi-row `INSERT` | ✓ | ✓ | ✓ | — | ✓ |
| `INSERT` ... SELECT | ✗ | ✗ | ✗ | ✗ | ✗ |
| `INSERT` ... with returned rows (`RETURNING`, `OUTPUT`) | ◐ | — | ◐ | ◐ | — |
| `INSERT` ... ON CONFLICT/DUPLICATE KEY | ◐ | ◐ | — | — | — |

**Notes:**
- **Oracle**: Uses `INSERT ALL` syntax for multi-row inserts (not supported)

---

### `ALTER TABLE`

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| **ADD COLUMN** | ✗ | ✗ | ✗ | ✗ | ✗ |
| **DROP COLUMN** | ✗ | ✗ | ✗ | ✗ | ✗ |
| **ALTER/MODIFY COLUMN** | ✗ | ✗ | ✗ | ✗ | ✗ |
| **RENAME COLUMN** | ✗ | ✗ | ✗ | ✗ | ✗ |
| **ADD CONSTRAINT** | | | | | |
| - `DEFAULT` | ✗ | ✗ | ✓ | ✓ | ✗ |
| - `NOT NULL` | ✗ | ✗ | ✗ | ✓ | ✗ |
| - `CHECK` | ✓ | ✓ | ✓ | ✓ | — |
| - `UNIQUE` | ✓ | ✗ | ✓ | ✓ | ✓ |
| - `PRIMARY KEY` | ✓ | ✓ | ✓ | ✓ | ✗ |
| - `FOREIGN KEY` | ✓ | ✓ | ✓ | ✓ | ✓ |
| **DROP CONSTRAINT** | ✗ | ✗ | ✗ | ✗ | ✗ |

---

### Comments

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| Table comments | ✓ | ✓ | ◐ | ✓ | ✓ |
| Column comments | ✓ | ✓ | ◐ | ✓ | ✗ |
| Comment syntax | `COMMENT ON` | Inline `COMMENT` | `sp_addextendedproperty` | `COMMENT ON` | Inline `COMMENT` |

**Notes:**
- **MSSQL**: Comments via `sp_addextendedproperty` have unreliable parsing

---

### Other DDL Statements

| Feature | PostgreSQL | MySQL | MSSQL | Oracle | Snowflake |
|---------|------------|-------|-------|--------|-----------|
| `DROP TABLE` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `DROP INDEX` | ✗ | ✗ | ✗ | ✗ | — |
| `ALTER INDEX` | ✗ | — | ✗ | ✗ | — |
| `CREATE VIEW` | ✗ | ✗ | ✗ | ✗ | ✗ |
