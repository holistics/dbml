# PostgreSQL SQL Parser Support

> Comprehensive documentation for the PostgreSQL model structure generator based on the ANTLR4 parser.

## Overview

This module provides SQL parsing capabilities for PostgreSQL databases, enabling conversion of PostgreSQL DDL statements to DBML format. The parser supports a wide range of PostgreSQL-specific syntax including enumerated types, `SERIAL`/`BIGSERIAL` columns, `GENERATED AS IDENTITY`, and various constraint definitions.

## Support Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Fully supported and correctly parsed |
| ◐ | Valid SQL that is parsed, but some options/clauses are ignored |
| ✗ | Valid PostgreSQL syntax, but the parser fails to generate output |
| — | Syntax not valid in PostgreSQL |

## Key Capabilities

- **Data Definition**
  - `CREATE TABLE` with full syntax support
  - Data types: enumerated types, parameterized types (e.g., `VARCHAR(255)`), array types (e.g., `INTEGER[]`)
- **Constraints**
  - `PRIMARY KEY` (column-level, table-level, multi-column, with explicit name)
  - `FOREIGN KEY` with `ON UPDATE` / `ON DELETE` actions
  - `UNIQUE`, `CHECK`, `DEFAULT`, `NOT NULL`
- **Auto-increment**
  - `SERIAL` / `BIGSERIAL`
  - `GENERATED AS IDENTITY`
- **Indexes**
  - `CREATE INDEX` with BTREE, HASH, GIST, BRIN, GIN
  - Function-based indexes (e.g., `LOWER(column)`)
- **Comments**
  - `COMMENT ON TABLE` / `COMMENT ON COLUMN` statements
- **Data Manipulation**
  - Basic `INSERT` and multi-row `INSERT`

---

## Feature Support Matrix

### `CREATE TABLE`

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `CREATE TABLE` syntax | ✓ | |
| Enumerated data types | ✓ | |
| Parameterized types `name(...)` | ✓ | e.g., `VARCHAR(255)`, `NUMERIC(10,2)` |
| Array types `name[...]` | ✓ | e.g., `INTEGER[]`, `TEXT[][]` |
| TEMPORARY tables | ◐ | Parsed but no indication of temporary status in output |
| `CREATE TABLE` AS SELECT | ✗ | |
| Table options (UNLOGGED, partition, etc.) | ◐ | Options are ignored |

### Constraints

#### `PRIMARY KEY`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `PRIMARY KEY` | ✓ | Defined with column: `id INT PRIMARY KEY` |
| Table-level `PRIMARY KEY` | ✓ | Defined separately: `PRIMARY KEY (id)` |
| Multi-column `PRIMARY KEY` | ✓ | Multiple columns: `PRIMARY KEY (a, b)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT pk_name PRIMARY KEY (id)` |
| DEFERRABLE / NOT DEFERRABLE | ◐ | Constraint timing options are ignored |

#### `FOREIGN KEY`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `FOREIGN KEY` | ✓ | `col INT REFERENCES other(id)` |
| Table-level `FOREIGN KEY` | ✓ | `FOREIGN KEY (col) REFERENCES other(id)` |
| Multi-column `FOREIGN KEY` | ✓ | `FOREIGN KEY (a, b) REFERENCES other(x, y)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT fk_name FOREIGN KEY ...` |
| `ON UPDATE` action | ✓ | CASCADE, SET NULL, SET DEFAULT, NO ACTION, RESTRICT |
| `ON DELETE` action | ✓ | CASCADE, SET NULL, SET DEFAULT, NO ACTION, RESTRICT |
| DEFERRABLE / NOT DEFERRABLE | ◐ | Constraint timing options are ignored |

#### `UNIQUE`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `UNIQUE` | ✓ | `col INT UNIQUE` |
| Table-level `UNIQUE` | ✓ | `UNIQUE (col)` |
| Multi-column `UNIQUE` | ✓ | `UNIQUE (a, b)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT uq_name UNIQUE (col)` |
| DEFERRABLE / NOT DEFERRABLE | ◐ | Constraint timing options are ignored |
| NULLS NOT DISTINCT | — | Treats NULLs as equal (PostgreSQL 15+) - not valid in older versions |
| `UNIQUE` KEY/`UNIQUE` INDEX syntax | — | MySQL syntax; use `CREATE INDEX` for indexes |

#### `CHECK`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `CHECK` | ✓ | `col INT CHECK (col > 0)` |
| Table-level `CHECK` | ✓ | `CHECK (col > 0)` |
| Explicitly named (CONSTRAINT name) | ✓ | Name ignored for column-level checks |
| NOT VALID / NO INHERIT | ◐ | Enforcement options are ignored |

#### `DEFAULT`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `DEFAULT` | ✓ | `col INT DEFAULT 0` |
| Table-level `DEFAULT` | — | PostgreSQL only supports column-level `DEFAULT` |
| Function as `DEFAULT` | ✓ | `DEFAULT NOW()`, `DEFAULT gen_random_uuid()` |
| Explicitly named `DEFAULT` | — | PostgreSQL doesn't support named `DEFAULT` constraints |

#### `NOT NULL` / NULL

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `NOT NULL` | ✓ | `col INT NOT NULL` |
| NULL (explicitly nullable) | ✓ | `col INT NULL` |
| Table-level `NOT NULL` | — | PostgreSQL only supports column-level `NOT NULL` |
| DEFERRABLE / NOT DEFERRABLE | ◐ | Constraint timing options are ignored |

### Auto-Increment Columns

| Feature | Status | Notes |
|---------|---------|-------|
| `SERIAL` (pseudo-type) | ✓ | `id SERIAL` - auto-incrementing 4-byte integer |
| `BIGSERIAL` (pseudo-type) | ✓ | `id BIGSERIAL` - auto-incrementing 8-byte integer |
| `GENERATED AS IDENTITY` (column property) | ✓ | `id INT GENERATED ALWAYS AS IDENTITY` |
| START WITH / INCREMENT BY | ◐ | Sequence options are ignored |
| `AUTO_INCREMENT` (column attribute) | — | MySQL syntax - not valid in PostgreSQL |
| `IDENTITY(seed, increment)` (column property) | — | SQL Server/Snowflake syntax - not valid in PostgreSQL |

### Inline Indexes (in `CREATE TABLE`)

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level indexes | — | Except for `UNIQUE`/`PRIMARY KEY` constraints |
| Table-level indexes | — | Use `CREATE INDEX` statement |

### Table/Column Comments (in `CREATE TABLE`)

| Feature | Status | Notes |
|---------|---------|-------|
| Table comments in `CREATE TABLE` | — | Use `COMMENT ON` statement |
| Column comments in `CREATE TABLE` | — | Use `COMMENT ON` statement |

---

### `CREATE INDEX`

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `CREATE INDEX` | ✓ | `CREATE INDEX idx ON table (col)` |
| Multi-column index | ✓ | `CREATE INDEX idx ON table (a, b)` |
| Explicitly named index | ✓ | Index name is required in PostgreSQL |
| `UNIQUE` index | ✓ | `CREATE UNIQUE INDEX idx ON table (col)` |
| BTREE index | ✓ | Default index type, B-tree structure |
| HASH index | ✓ | Hash-based index for equality comparisons |
| GIST index | ✓ | Generalized Search Tree for complex types |
| BRIN index | ✓ | Block Range Index for large sequential data |
| GIN index | ✓ | Generalized Inverted Index for arrays/JSON |
| Function-based index | ✓ | `CREATE INDEX ON t (LOWER(col))` |
| Partial index (WHERE clause) | ◐ | `WHERE condition` is ignored |
| INCLUDE columns | ◐ | Covering index columns are ignored |
| NULLS FIRST/LAST | ◐ | NULL ordering is ignored |
| ASC/DESC | ◐ | Sort direction is ignored |
| COLLATE | ◐ | Collation settings are ignored |
| Index comments | ◐ | Comments are ignored |
| CLUSTERED/NONCLUSTERED | — | SQL Server syntax - not valid in PostgreSQL |
| FULLTEXT index | — | MySQL syntax - use GIN with tsvector |
| SPATIAL index | — | MySQL syntax - use GIST with geometry |

---

### `INSERT` Statements

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `INSERT` ... VALUES | ✓ | `INSERT INTO t (col) VALUES (1)` |
| Multi-row `INSERT` | ✓ | `INSERT INTO t VALUES (1), (2), (3)` |
| `INSERT` ... SELECT | ✗ | Subquery as data source |
| WITH clause (CTE) | ✗ | Common Table Expression before `INSERT` |
| Table alias in `INSERT` | ✗ | `INSERT INTO t AS alias ...` |
| `INSERT` ... RETURNING | ◐ | Returns inserted rows - clause is ignored |
| `INSERT` ... ON CONFLICT (UPSERT) | ◐ | Upsert behavior - clause is ignored |
| `INSERT` OVERWRITE | — | Snowflake/Hive syntax - not valid in PostgreSQL |
| Multi-table `INSERT` | ✗ | Insert into multiple tables at once |
| Conditional `INSERT` (WHEN/ALL/FIRST) | ✗ | Oracle syntax for conditional inserts |

---

### `ALTER TABLE`

| Feature | Status | Notes |
|---------|---------|-------|
| **ADD COLUMN** | | |
| - All column properties | ✗ | |
| **DROP COLUMN** | ✗ | |
| **ALTER COLUMN / MODIFY** | | |
| - All modifications | ✗ | |
| **RENAME COLUMN** | ✗ | |
| **ADD CONSTRAINT** | | |
| - Named `CHECK` | ✓ | |
| - Unnamed `CHECK` | ✓ | |
| - Named `UNIQUE` | ✓ | Name is ignored |
| - Unnamed `UNIQUE` | ✓ | |
| - Named `PRIMARY KEY` | ◐ | Name is ignored |
| - Unnamed `PRIMARY KEY` | ✓ | |
| - Named `FOREIGN KEY` | ✓ | |
| - Unnamed `FOREIGN KEY` | ✓ | |
| - `DEFAULT` | ✗ | Parse failure |
| - `NOT NULL` / NULL | ✗ | |
| **DROP CONSTRAINT** | ✗ | |
| **ALTER CONSTRAINT** | ✗ | |
| **RENAME TABLE** | ✗ | |
| **SET SCHEMA** | ✗ | |

---

### Other DDL Statements

| Feature | Status | Notes |
|---------|---------|-------|
| `DROP TABLE` | ✗ | |
| `DROP INDEX` | ✗ | |
| `ALTER INDEX` | ✗ | |
| `CREATE VIEW` | ✗ | |

---

### Comments (`COMMENT ON`)

| Feature | Status | Notes |
|---------|---------|-------|
| `COMMENT ON TABLE` | ✓ | |
| `COMMENT ON COLUMN` | ✓ | |
| COMMENT ... IS NULL | ✓ | Removes comment |
| `COMMENT ON INDEX` | ◐ | Ignored |

---

## Known Limitations

- **`ALTER TABLE` operations**: Limited support; primarily ADD CONSTRAINT is functional
- **DDL modification statements**: `DROP TABLE`, `DROP INDEX`, `ALTER INDEX` not supported
- **`INSERT` ... SELECT**: Subqueries in `INSERT` statements not supported
- **`CREATE VIEW`**: View definitions are not parsed
- **Constraint options**: Advanced options like DEFERRABLE, INITIALLY DEFERRED are ignored
- **Index options**: Partial indexes (WHERE clause), INCLUDE columns, and ordering options are parsed but ignored

## PostgreSQL-Specific Notes

1. **`SERIAL`/`BIGSERIAL`**: These pseudo-types are correctly recognized and converted to auto-increment columns in DBML
2. **Enumerated Types**: `CREATE TYPE ... AS ENUM` definitions are supported and referenced enum types in columns are recognized
3. **Array Types**: PostgreSQL array syntax (e.g., `INTEGER[]`, `TEXT[][]`) is properly parsed
4. **`GENERATED AS IDENTITY`**: The SQL standard identity column syntax is fully supported as an alternative to `SERIAL`
5. **Comments**: Use separate `COMMENT ON TABLE/COLUMN` statements rather than inline comments
