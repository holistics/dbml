# Microsoft SQL Server Parser Support

> Comprehensive documentation for the MSSQL (SQL Server) model structure generator based on the ANTLR4 parser.

## Overview

This module provides SQL parsing capabilities for Microsoft SQL Server databases, enabling conversion of T-SQL DDL statements to DBML format. The parser supports SQL Server-specific syntax including `IDENTITY` columns with increment ranges, temporary tables via the `#` prefix convention, and comprehensive `ALTER TABLE ADD CONSTRAINT` operations. Note that there is a known issue with column-level `FOREIGN KEY` constraint parsing.

## Support Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Fully supported and correctly parsed |
| ◐ | Valid SQL that is parsed, but some options/clauses are ignored |
| ✗ | Valid T-SQL syntax, but the parser fails to generate output |
| — | Syntax not valid in SQL Server |

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

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `CREATE TABLE` syntax | ✓ | |
| Enumerated data types | — | SQL Server doesn't have ENUM type |
| Parameterized types `name(...)` | ✓ | e.g., `VARCHAR(255)`, `DECIMAL(10,2)` |
| Array types `name[...]` | — | Not supported in SQL Server |
| TEMPORARY tables (`#` prefix) | ✓ | Tables with `#` prefix recognized as temporary |
| `CREATE TABLE` AS SELECT (SELECT INTO) | ✗ | |
| Table options (FILEGROUP, etc.) | ◐ | Options are ignored |

### Constraints

#### `PRIMARY KEY`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `PRIMARY KEY` | ✓ | Defined with column: `id INT PRIMARY KEY` |
| Table-level `PRIMARY KEY` | ✓ | Defined separately: `PRIMARY KEY (id)` |
| Multi-column `PRIMARY KEY` | ✓ | Multiple columns: `PRIMARY KEY (a, b)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT pk_name PRIMARY KEY (id)` |
| CLUSTERED/NONCLUSTERED | ◐ | Index type options are ignored |
| Constraint options | ◐ | Other options are ignored |

#### `FOREIGN KEY`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `FOREIGN KEY` | ✗ | Known bug - use table-level syntax instead |
| Table-level `FOREIGN KEY` | ✓ | `FOREIGN KEY (col) REFERENCES other(id)` |
| Multi-column `FOREIGN KEY` | ✓ | `FOREIGN KEY (a, b) REFERENCES other(x, y)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT fk_name FOREIGN KEY ...` |
| `ON UPDATE` action | ✓ | CASCADE, SET NULL, SET DEFAULT, NO ACTION |
| `ON DELETE` action | ✓ | CASCADE, SET NULL, SET DEFAULT, NO ACTION |
| Constraint options | ◐ | Other options are ignored |

#### `UNIQUE`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `UNIQUE` | ✓ | `col INT UNIQUE` |
| Table-level `UNIQUE` | ✓ | `UNIQUE (col)` |
| Multi-column `UNIQUE` | ✓ | `UNIQUE (a, b)` |
| Explicitly named (CONSTRAINT name) | ◐ | `CONSTRAINT uq_name UNIQUE (col)` - name is ignored |
| CLUSTERED/NONCLUSTERED | ◐ | Index type options are ignored |
| Constraint options | ◐ | Other options are ignored |
| NULLS NOT DISTINCT | — | Not valid in SQL Server |
| `UNIQUE KEY`/`UNIQUE INDEX` | — | MySQL syntax - not valid in SQL Server |

#### `CHECK`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `CHECK` | ✓ | `col INT CHECK (col > 0)` |
| Table-level `CHECK` | ✓ | `CHECK (col > 0)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT chk_name CHECK (col > 0)` |
| WITH CHECK / WITH NOCHECK | ◐ | Enforcement options are ignored |

#### `DEFAULT`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `DEFAULT` | ✓ | `col INT DEFAULT 0` |
| Table-level `DEFAULT` | ✗ | Completely ignored |
| Function as `DEFAULT` | ✓ | `DEFAULT GETDATE()`, `DEFAULT NEWID()` |
| Explicitly named `DEFAULT` | ◐ | `CONSTRAINT df_name DEFAULT 0` - name is ignored |

#### `NOT NULL` / NULL

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `NOT NULL` | ✓ | `col INT NOT NULL` |
| NULL (explicitly nullable) | ✓ | `col INT NULL` |
| Table-level `NOT NULL` | — | SQL Server only supports column-level `NOT NULL` |
| Constraint options | ◐ | Other options are ignored |

### Auto-Increment Columns

| Feature | Status | Notes |
|---------|---------|-------|
| `IDENTITY` (column property) | ✓ | `id INT IDENTITY` |
| `IDENTITY` with seed and increment | ✓ | `id INT IDENTITY(1,1)` - starts at 1, increments by 1 |
| `AUTO_INCREMENT` (column attribute) | — | MySQL syntax - not valid in SQL Server |
| `SERIAL` (pseudo-type) | — | PostgreSQL syntax - not valid in SQL Server |
| `BIGSERIAL` (pseudo-type) | — | PostgreSQL syntax - not valid in SQL Server |
| `GENERATED AS IDENTITY` (column property) | ✗ | SQL standard syntax - parse failure |

### Inline Indexes (in `CREATE TABLE`)

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level indexes | — | Except for `UNIQUE`/`PRIMARY KEY` constraints |
| Table-level indexes | — | Except for `UNIQUE`/`PRIMARY KEY` constraints |
| Named indexes | — | Use `CREATE INDEX` statement |
| Multi-column indexes | — | Use `CREATE INDEX` statement |
| CLUSTERED/NONCLUSTERED | ◐ | Index type options are ignored |
| Index options | — | Use `CREATE INDEX` statement |

### Table/Column Comments (in `CREATE TABLE`)

| Feature | Status | Notes |
|---------|---------|-------|
| Table comments | — | SQL Server uses `sp_addextendedproperty` |
| Column comments | — | SQL Server uses `sp_addextendedproperty` |

---

### `CREATE INDEX`

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `CREATE INDEX` | ✓ | `CREATE INDEX idx ON table (col)` |
| Multi-column index | ✓ | `CREATE INDEX idx ON table (a, b)` |
| Explicitly named index | ✓ | Index name is required in SQL Server |
| `UNIQUE` index | ✓ | `CREATE UNIQUE INDEX idx ON table (col)` |
| CLUSTERED index | ◐ | Index type is ignored |
| NONCLUSTERED index | ◐ | Index type is ignored |
| Function-based index | — | SQL Server uses computed columns instead |
| Partial/Filtered index (WHERE clause) | ◐ | WHERE condition is ignored |
| INCLUDE columns | ◐ | Covering index columns are ignored |
| BTREE/HASH | ✗ | PostgreSQL syntax - parse failure |
| COLLATE | — | Not applicable to SQL Server indexes |
| Index comments | — | Use `sp_addextendedproperty` |
| NULLS FIRST/LAST | — | Not valid in SQL Server |
| ASC/DESC | ◐ | Sort direction is ignored |
| FULLTEXT index | ✗ | Parse failure |
| SPATIAL index | ✗ | Parse failure |

---

### `INSERT` Statements

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `INSERT` ... VALUES | ✓ | `INSERT INTO t (col) VALUES (1)` |
| Multi-row `INSERT` | ✓ | `INSERT INTO t VALUES (1), (2), (3)` |
| `INSERT` ... SELECT | ✗ | Subquery as data source |
| WITH clause (CTE) | ✗ | CTE before `INSERT` |
| Target table alias | — | Not valid in SQL Server |
| `INSERT` ... OUTPUT | ◐ | Returns inserted rows - clause is ignored |
| `INSERT` OVERWRITE | — | Snowflake/Hive syntax - not valid in SQL Server |
| Multi-table `INSERT` | ✗ | Insert into multiple tables at once |
| Conditional `INSERT` | ✗ | |

---

### `ALTER TABLE`

| Feature | Status | Notes |
|---------|---------|-------|
| **ADD COLUMN** | | |
| - All column properties | ✗ | |
| **DROP COLUMN** | ✗ | |
| **ALTER COLUMN** | | |
| - All modifications | ✗ | |
| **RENAME COLUMN** | ✗ | |
| **ADD CONSTRAINT** | | |
| - Named `DEFAULT` | ✓ | Name is ignored |
| - `NOT NULL` | ✗ | |
| - NULL | ✗ | |
| - Named `CHECK` | ✓ | |
| - Unnamed `CHECK` | ✓ | |
| - Named `UNIQUE` | ✓ | |
| - Unnamed `UNIQUE` | ✓ | |
| - Named `PRIMARY KEY` | ✓ | |
| - Unnamed `PRIMARY KEY` | ✓ | |
| - Named `FOREIGN KEY` | ✓ | |
| - Unnamed `FOREIGN KEY` | ✓ | |
| **DROP CONSTRAINT** | ✗ | |
| **ALTER CONSTRAINT** | ✗ | |
| **RENAME TABLE (`sp_rename`)** | ✗ | |
| **TRANSFER (schema change)** | ✗ | |
| **ADD INDEX** | ✗ | |

---

### Other DDL Statements

| Feature | Status | Notes |
|---------|---------|-------|
| `DROP TABLE` | ✗ | |
| `DROP INDEX` | ✗ | |
| `ALTER INDEX` | ✗ | |
| `CREATE VIEW` | ✗ | |

---

### Comments (Extended Properties)

| Feature | Status | Notes |
|---------|---------|-------|
| `sp_addextendedproperty` (table) | ✓ | `MS_Description` for tables - parsing is unreliable |
| `sp_addextendedproperty` (column) | ✓ | `MS_Description` for columns - parsing is unreliable |
| `sp_dropextendedproperty` | ✓ | Remove extended property - parsing is unreliable |

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
