# PostgreSQL SQL Parser Support

> Comprehensive documentation for the PostgreSQL model structure generator based on the ANTLR4 parser.

## Overview

This module provides SQL parsing capabilities for PostgreSQL databases, enabling conversion of PostgreSQL DDL statements to DBML format. The parser supports a wide range of PostgreSQL-specific syntax including enumerated types, `SERIAL`/`BIGSERIAL` columns, `GENERATED AS IDENTITY`, and various constraint definitions.

## Support Legend

| Symbol | Meaning |
|--------|---------|
| Supported | Feature is fully supported and correctly parsed |
| Partial | Valid SQL that is parsed, but some options/clauses are ignored in the output |
| Not Supported | Valid PostgreSQL syntax, but the parser fails to generate output |
| N/A | Syntax not valid in PostgreSQL |

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

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `CREATE TABLE` syntax | Supported | |
| Enumerated data types | Supported | |
| Parameterized types `name(...)` | Supported | e.g., `VARCHAR(255)`, `NUMERIC(10,2)` |
| Array types `name[...]` | Supported | e.g., `INTEGER[]`, `TEXT[][]` |
| TEMPORARY tables | Partial | Parsed but no indication of temporary status in output |
| `CREATE TABLE` AS SELECT | Not Supported | |
| Table options (UNLOGGED, partition, etc.) | Partial | Options are ignored |

### Constraints

#### `PRIMARY KEY`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `PRIMARY KEY` | Supported | Defined with column: `id INT PRIMARY KEY` |
| Table-level `PRIMARY KEY` | Supported | Defined separately: `PRIMARY KEY (id)` |
| Multi-column `PRIMARY KEY` | Supported | Multiple columns: `PRIMARY KEY (a, b)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT pk_name PRIMARY KEY (id)` |
| DEFERRABLE / NOT DEFERRABLE | Partial | Constraint timing options are ignored |

#### `FOREIGN KEY`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `FOREIGN KEY` | Supported | `col INT REFERENCES other(id)` |
| Table-level `FOREIGN KEY` | Supported | `FOREIGN KEY (col) REFERENCES other(id)` |
| Multi-column `FOREIGN KEY` | Supported | `FOREIGN KEY (a, b) REFERENCES other(x, y)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT fk_name FOREIGN KEY ...` |
| `ON UPDATE` action | Supported | CASCADE, SET NULL, SET DEFAULT, NO ACTION, RESTRICT |
| `ON DELETE` action | Supported | CASCADE, SET NULL, SET DEFAULT, NO ACTION, RESTRICT |
| DEFERRABLE / NOT DEFERRABLE | Partial | Constraint timing options are ignored |

#### `UNIQUE`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `UNIQUE` | Supported | `col INT UNIQUE` |
| Table-level `UNIQUE` | Supported | `UNIQUE (col)` |
| Multi-column `UNIQUE` | Supported | `UNIQUE (a, b)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT uq_name UNIQUE (col)` |
| DEFERRABLE / NOT DEFERRABLE | Partial | Constraint timing options are ignored |
| NULLS NOT DISTINCT | N/A | Treats NULLs as equal (PostgreSQL 15+) - not valid in older versions |
| `UNIQUE` KEY/`UNIQUE` INDEX syntax | N/A | MySQL syntax; use `CREATE INDEX` for indexes |

#### `CHECK`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `CHECK` | Supported | `col INT CHECK (col > 0)` |
| Table-level `CHECK` | Supported | `CHECK (col > 0)` |
| Explicitly named (CONSTRAINT name) | Supported | Name ignored for column-level checks |
| NOT VALID / NO INHERIT | Partial | Enforcement options are ignored |

#### `DEFAULT`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `DEFAULT` | Supported | `col INT DEFAULT 0` |
| Table-level `DEFAULT` | N/A | PostgreSQL only supports column-level `DEFAULT` |
| Function as `DEFAULT` | Supported | `DEFAULT NOW()`, `DEFAULT gen_random_uuid()` |
| Explicitly named `DEFAULT` | N/A | PostgreSQL doesn't support named `DEFAULT` constraints |

#### `NOT NULL` / NULL

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `NOT NULL` | Supported | `col INT NOT NULL` |
| NULL (explicitly nullable) | Supported | `col INT NULL` |
| Table-level `NOT NULL` | N/A | PostgreSQL only supports column-level `NOT NULL` |
| DEFERRABLE / NOT DEFERRABLE | Partial | Constraint timing options are ignored |

### Auto-Increment Columns

| Feature | Support | Notes |
|---------|---------|-------|
| `SERIAL` (pseudo-type) | Supported | `id SERIAL` - auto-incrementing 4-byte integer |
| `BIGSERIAL` (pseudo-type) | Supported | `id BIGSERIAL` - auto-incrementing 8-byte integer |
| `GENERATED AS IDENTITY` (column property) | Supported | `id INT GENERATED ALWAYS AS IDENTITY` |
| START WITH / INCREMENT BY | Partial | Sequence options are ignored |
| `AUTO_INCREMENT` (column attribute) | N/A | MySQL syntax - not valid in PostgreSQL |
| `IDENTITY(seed, increment)` (column property) | N/A | SQL Server/Snowflake syntax - not valid in PostgreSQL |

### Inline Indexes (in `CREATE TABLE`)

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level indexes | N/A | Except for `UNIQUE`/`PRIMARY KEY` constraints |
| Table-level indexes | N/A | Use `CREATE INDEX` statement |

### Table/Column Comments (in `CREATE TABLE`)

| Feature | Support | Notes |
|---------|---------|-------|
| Table comments in `CREATE TABLE` | N/A | Use `COMMENT ON` statement |
| Column comments in `CREATE TABLE` | N/A | Use `COMMENT ON` statement |

---

### `CREATE INDEX`

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `CREATE INDEX` | Supported | `CREATE INDEX idx ON table (col)` |
| Multi-column index | Supported | `CREATE INDEX idx ON table (a, b)` |
| Explicitly named index | Supported | Index name is required in PostgreSQL |
| `UNIQUE` index | Supported | `CREATE UNIQUE INDEX idx ON table (col)` |
| BTREE index | Supported | Default index type, B-tree structure |
| HASH index | Supported | Hash-based index for equality comparisons |
| GIST index | Supported | Generalized Search Tree for complex types |
| BRIN index | Supported | Block Range Index for large sequential data |
| GIN index | Supported | Generalized Inverted Index for arrays/JSON |
| Function-based index | Supported | `CREATE INDEX ON t (LOWER(col))` |
| Partial index (WHERE clause) | Partial | `WHERE condition` is ignored |
| INCLUDE columns | Partial | Covering index columns are ignored |
| NULLS FIRST/LAST | Partial | NULL ordering is ignored |
| ASC/DESC | Partial | Sort direction is ignored |
| COLLATE | Partial | Collation settings are ignored |
| Index comments | Partial | Comments are ignored |
| CLUSTERED/NONCLUSTERED | N/A | SQL Server syntax - not valid in PostgreSQL |
| FULLTEXT index | N/A | MySQL syntax - use GIN with tsvector |
| SPATIAL index | N/A | MySQL syntax - use GIST with geometry |

---

### `INSERT` Statements

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `INSERT` ... VALUES | Supported | `INSERT INTO t (col) VALUES (1)` |
| Multi-row `INSERT` | Supported | `INSERT INTO t VALUES (1), (2), (3)` |
| `INSERT` ... SELECT | Not Supported | Subquery as data source |
| WITH clause (CTE) | Not Supported | Common Table Expression before `INSERT` |
| Table alias in `INSERT` | Not Supported | `INSERT INTO t AS alias ...` |
| `INSERT` ... RETURNING | Partial | Returns inserted rows - clause is ignored |
| `INSERT` ... ON CONFLICT (UPSERT) | Partial | Upsert behavior - clause is ignored |
| `INSERT` OVERWRITE | N/A | Snowflake/Hive syntax - not valid in PostgreSQL |
| Multi-table `INSERT` | Not Supported | Insert into multiple tables at once |
| Conditional `INSERT` (WHEN/ALL/FIRST) | Not Supported | Oracle syntax for conditional inserts |

---

### `ALTER TABLE`

| Feature | Support | Notes |
|---------|---------|-------|
| **ADD COLUMN** | | |
| - All column properties | Not Supported | |
| **DROP COLUMN** | Not Supported | |
| **ALTER COLUMN / MODIFY** | | |
| - All modifications | Not Supported | |
| **RENAME COLUMN** | Not Supported | |
| **ADD CONSTRAINT** | | |
| - Named `CHECK` | Supported | |
| - Unnamed `CHECK` | Supported | |
| - Named `UNIQUE` | Supported | Name is ignored |
| - Unnamed `UNIQUE` | Supported | |
| - Named `PRIMARY KEY` | Partial | Name is ignored |
| - Unnamed `PRIMARY KEY` | Supported | |
| - Named `FOREIGN KEY` | Supported | |
| - Unnamed `FOREIGN KEY` | Supported | |
| - `DEFAULT` | Not Supported | Parse failure |
| - `NOT NULL` / NULL | Not Supported | |
| **DROP CONSTRAINT** | Not Supported | |
| **ALTER CONSTRAINT** | Not Supported | |
| **RENAME TABLE** | Not Supported | |
| **SET SCHEMA** | Not Supported | |

---

### Other DDL Statements

| Feature | Support | Notes |
|---------|---------|-------|
| `DROP TABLE` | Not Supported | |
| `DROP INDEX` | Not Supported | |
| `ALTER INDEX` | Not Supported | |
| `CREATE VIEW` | Not Supported | |

---

### Comments (`COMMENT ON`)

| Feature | Support | Notes |
|---------|---------|-------|
| `COMMENT ON TABLE` | Supported | |
| `COMMENT ON COLUMN` | Supported | |
| COMMENT ... IS NULL | Supported | Removes comment |
| `COMMENT ON INDEX` | Partial | Ignored |

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
