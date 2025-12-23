# Microsoft SQL Server Parser Support

> Comprehensive documentation for the MSSQL (SQL Server) model structure generator based on the ANTLR4 parser.

## Overview

This module provides SQL parsing capabilities for Microsoft SQL Server databases, enabling conversion of T-SQL DDL statements to DBML format. The parser supports SQL Server-specific syntax including `IDENTITY` columns with increment ranges, temporary tables via the `#` prefix convention, and comprehensive `ALTER TABLE ADD CONSTRAINT` operations. Note that there is a known issue with column-level `FOREIGN KEY` constraint parsing.

## Support Legend

| Symbol | Meaning |
|--------|---------|
| Supported | Feature is fully supported and correctly parsed |
| Partial | Valid SQL that is parsed, but some options/clauses are ignored in the output |
| Not Supported | Valid T-SQL syntax, but the parser fails to generate output |
| N/A | Syntax not valid in SQL Server |

## Key Capabilities

- **Data Definition**
  - `CREATE TABLE` with full syntax support
  - Data types: parameterized types (e.g., `VARCHAR(255)`, `DECIMAL(10,2)`)
  - Temporary tables via `#` prefix (e.g., `#temp_table`)
- **Constraints**
  - `PRIMARY KEY` (column-level, table-level, multi-column, with explicit name)
  - `FOREIGN KEY` (table-level supported; column-level has a bug)
  - `UNIQUE`, `CHECK`, `DEFAULT`, `NOT NULL`
- **Auto-increment**
  - `IDENTITY` with seed and increment (e.g., `IDENTITY(1,1)`)
- **Indexes**
  - `CREATE INDEX` (basic, multi-column, unique)
  - CLUSTERED / NONCLUSTERED (parsed but ignored)
- **Comments**
  - `sp_addextendedproperty` (unreliable parsing)
- **Schema Modification**
  - `ALTER TABLE ADD CONSTRAINT`
    - Supports: `DEFAULT`, `CHECK`, `UNIQUE`, `PRIMARY KEY`, `FOREIGN KEY`
- **Data Manipulation**
  - Basic `INSERT` and multi-row `INSERT`

---

## Feature Support Matrix

### `CREATE TABLE`

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `CREATE TABLE` syntax | Supported | |
| Enumerated data types | N/A | SQL Server doesn't have ENUM type |
| Parameterized types `name(...)` | Supported | e.g., `VARCHAR(255)`, `DECIMAL(10,2)` |
| Array types `name[...]` | N/A | Not supported in SQL Server |
| TEMPORARY tables (`#` prefix) | Supported | Tables with `#` prefix recognized as temporary |
| `CREATE TABLE` AS SELECT (SELECT INTO) | Not Supported | |
| Table options (FILEGROUP, etc.) | Partial | Options are ignored |

### Constraints

#### `PRIMARY KEY`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `PRIMARY KEY` | Supported | Defined with column: `id INT PRIMARY KEY` |
| Table-level `PRIMARY KEY` | Supported | Defined separately: `PRIMARY KEY (id)` |
| Multi-column `PRIMARY KEY` | Supported | Multiple columns: `PRIMARY KEY (a, b)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT pk_name PRIMARY KEY (id)` |
| CLUSTERED/NONCLUSTERED | Partial | Index type options are ignored |
| Constraint options | Partial | Other options are ignored |

#### `FOREIGN KEY`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `FOREIGN KEY` | Not Supported | Known bug - use table-level syntax instead |
| Table-level `FOREIGN KEY` | Supported | `FOREIGN KEY (col) REFERENCES other(id)` |
| Multi-column `FOREIGN KEY` | Supported | `FOREIGN KEY (a, b) REFERENCES other(x, y)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT fk_name FOREIGN KEY ...` |
| `ON UPDATE` action | Supported | CASCADE, SET NULL, SET DEFAULT, NO ACTION |
| `ON DELETE` action | Supported | CASCADE, SET NULL, SET DEFAULT, NO ACTION |
| Constraint options | Partial | Other options are ignored |

#### `UNIQUE`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `UNIQUE` | Supported | `col INT UNIQUE` |
| Table-level `UNIQUE` | Supported | `UNIQUE (col)` |
| Multi-column `UNIQUE` | Supported | `UNIQUE (a, b)` |
| Explicitly named (CONSTRAINT name) | Partial | `CONSTRAINT uq_name UNIQUE (col)` - name is ignored |
| CLUSTERED/NONCLUSTERED | Partial | Index type options are ignored |
| Constraint options | Partial | Other options are ignored |
| NULLS NOT DISTINCT | N/A | Not valid in SQL Server |
| `UNIQUE KEY`/`UNIQUE INDEX` | N/A | MySQL syntax - not valid in SQL Server |

#### `CHECK`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `CHECK` | Supported | `col INT CHECK (col > 0)` |
| Table-level `CHECK` | Supported | `CHECK (col > 0)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT chk_name CHECK (col > 0)` |
| WITH CHECK / WITH NOCHECK | Partial | Enforcement options are ignored |

#### `DEFAULT`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `DEFAULT` | Supported | `col INT DEFAULT 0` |
| Table-level `DEFAULT` | Not Supported | Completely ignored |
| Function as `DEFAULT` | Supported | `DEFAULT GETDATE()`, `DEFAULT NEWID()` |
| Explicitly named `DEFAULT` | Partial | `CONSTRAINT df_name DEFAULT 0` - name is ignored |

#### `NOT NULL` / NULL

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `NOT NULL` | Supported | `col INT NOT NULL` |
| NULL (explicitly nullable) | Supported | `col INT NULL` |
| Table-level `NOT NULL` | N/A | SQL Server only supports column-level `NOT NULL` |
| Constraint options | Partial | Other options are ignored |

### Auto-Increment Columns

| Feature | Support | Notes |
|---------|---------|-------|
| `IDENTITY` (column property) | Supported | `id INT IDENTITY` |
| `IDENTITY` with seed and increment | Supported | `id INT IDENTITY(1,1)` - starts at 1, increments by 1 |
| `AUTO_INCREMENT` (column attribute) | N/A | MySQL syntax - not valid in SQL Server |
| `SERIAL` (pseudo-type) | N/A | PostgreSQL syntax - not valid in SQL Server |
| `BIGSERIAL` (pseudo-type) | N/A | PostgreSQL syntax - not valid in SQL Server |
| `GENERATED AS IDENTITY` (column property) | Not Supported | SQL standard syntax - parse failure |

### Inline Indexes (in `CREATE TABLE`)

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level indexes | N/A | Except for `UNIQUE`/`PRIMARY KEY` constraints |
| Table-level indexes | N/A | Except for `UNIQUE`/`PRIMARY KEY` constraints |
| Named indexes | N/A | Use `CREATE INDEX` statement |
| Multi-column indexes | N/A | Use `CREATE INDEX` statement |
| CLUSTERED/NONCLUSTERED | Partial | Index type options are ignored |
| Index options | N/A | Use `CREATE INDEX` statement |

### Table/Column Comments (in `CREATE TABLE`)

| Feature | Support | Notes |
|---------|---------|-------|
| Table comments | N/A | SQL Server uses `sp_addextendedproperty` |
| Column comments | N/A | SQL Server uses `sp_addextendedproperty` |

---

### `CREATE INDEX`

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `CREATE INDEX` | Supported | `CREATE INDEX idx ON table (col)` |
| Multi-column index | Supported | `CREATE INDEX idx ON table (a, b)` |
| Explicitly named index | Supported | Index name is required in SQL Server |
| `UNIQUE` index | Supported | `CREATE UNIQUE INDEX idx ON table (col)` |
| CLUSTERED index | Partial | Index type is ignored |
| NONCLUSTERED index | Partial | Index type is ignored |
| Function-based index | N/A | SQL Server uses computed columns instead |
| Partial/Filtered index (WHERE clause) | Partial | WHERE condition is ignored |
| INCLUDE columns | Partial | Covering index columns are ignored |
| BTREE/HASH | Not Supported | PostgreSQL syntax - parse failure |
| COLLATE | N/A | Not applicable to SQL Server indexes |
| Index comments | N/A | Use `sp_addextendedproperty` |
| NULLS FIRST/LAST | N/A | Not valid in SQL Server |
| ASC/DESC | Partial | Sort direction is ignored |
| FULLTEXT index | Not Supported | Parse failure |
| SPATIAL index | Not Supported | Parse failure |

---

### `INSERT` Statements

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `INSERT` ... VALUES | Supported | `INSERT INTO t (col) VALUES (1)` |
| Multi-row `INSERT` | Supported | `INSERT INTO t VALUES (1), (2), (3)` |
| `INSERT` ... SELECT | Not Supported | Subquery as data source |
| WITH clause (CTE) | Not Supported | CTE before `INSERT` |
| Target table alias | N/A | Not valid in SQL Server |
| `INSERT` ... OUTPUT | Partial | Returns inserted rows - clause is ignored |
| `INSERT` OVERWRITE | N/A | Snowflake/Hive syntax - not valid in SQL Server |
| Multi-table `INSERT` | Not Supported | Insert into multiple tables at once |
| Conditional `INSERT` | Not Supported | |

---

### `ALTER TABLE`

| Feature | Support | Notes |
|---------|---------|-------|
| **ADD COLUMN** | | |
| - All column properties | Not Supported | |
| **DROP COLUMN** | Not Supported | |
| **ALTER COLUMN** | | |
| - All modifications | Not Supported | |
| **RENAME COLUMN** | Not Supported | |
| **ADD CONSTRAINT** | | |
| - Named `DEFAULT` | Supported | Name is ignored |
| - `NOT NULL` | Not Supported | |
| - NULL | Not Supported | |
| - Named `CHECK` | Supported | |
| - Unnamed `CHECK` | Supported | |
| - Named `UNIQUE` | Supported | |
| - Unnamed `UNIQUE` | Supported | |
| - Named `PRIMARY KEY` | Supported | |
| - Unnamed `PRIMARY KEY` | Supported | |
| - Named `FOREIGN KEY` | Supported | |
| - Unnamed `FOREIGN KEY` | Supported | |
| **DROP CONSTRAINT** | Not Supported | |
| **ALTER CONSTRAINT** | Not Supported | |
| **RENAME TABLE (`sp_rename`)** | Not Supported | |
| **TRANSFER (schema change)** | Not Supported | |
| **ADD INDEX** | Not Supported | |

---

### Other DDL Statements

| Feature | Support | Notes |
|---------|---------|-------|
| `DROP TABLE` | Not Supported | |
| `DROP INDEX` | Not Supported | |
| `ALTER INDEX` | Not Supported | |
| `CREATE VIEW` | Not Supported | |

---

### Comments (Extended Properties)

| Feature | Support | Notes |
|---------|---------|-------|
| `sp_addextendedproperty` (table) | Supported | `MS_Description` for tables - parsing is unreliable |
| `sp_addextendedproperty` (column) | Supported | `MS_Description` for columns - parsing is unreliable |
| `sp_dropextendedproperty` | Supported | Remove extended property - parsing is unreliable |

---

## Known Limitations

- **Column-level `FOREIGN KEY`**: Column-level (inline) `FOREIGN KEY` definitions have a known bug; use table-level syntax instead
- **`GENERATED AS IDENTITY`**: SQL standard syntax not supported; use `IDENTITY(seed, increment)` instead
- **Extended properties for comments**: Parsing is unreliable
- **`ALTER TABLE` operations**: Limited support outside of ADD CONSTRAINT
- **DDL modification statements**: `DROP TABLE`, `DROP INDEX`, `ALTER INDEX` not supported
- **`INSERT` ... SELECT**: Subqueries in `INSERT` statements not supported
- **`CREATE VIEW`**: View definitions are not parsed
- **Filtered indexes**: WHERE clause is parsed but ignored
- **Index types**: BTREE, FULLTEXT, SPATIAL fail to parse

## SQL Server-Specific Notes

1. **`IDENTITY` Columns**: SQL Server uses `IDENTITY(seed, increment)` syntax. Both seed and increment values are supported, e.g., `IDENTITY(1,1)` starts at 1 and increments by 1
2. **Temporary Tables**: Tables prefixed with `#` (local temp) or `##` (global temp) are recognized as temporary tables
3. **Column-level `FOREIGN KEY` Bug**: There is a known bug with column-level (inline) `FOREIGN KEY` syntax. Use table-level `FOREIGN KEY` constraints instead
4. **Comments via Extended Properties**: SQL Server doesn't have native comment syntax. Use `sp_addextendedproperty` for `MS_Description`, but parsing is unreliable
5. **`ALTER TABLE ADD CONSTRAINT`**: Works well for `CHECK`, `UNIQUE`, `PRIMARY KEY`, and `FOREIGN KEY` - use this as a workaround for `CREATE TABLE` limitations
6. **Square Bracket Identifiers**: SQL Server's `[identifier]` syntax is supported in addition to standard double quotes
7. **CLUSTERED vs NONCLUSTERED**: SQL Server-specific index options are parsed but ignored in DBML output
