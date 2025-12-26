# MySQL SQL Parser Support

> Comprehensive documentation for the MySQL model structure generator based on the ANTLR4 parser.

## Overview

This module provides SQL parsing capabilities for MySQL databases, enabling conversion of MySQL DDL statements to DBML format. The parser supports MySQL-specific syntax including `AUTO_INCREMENT` columns, `UNIQUE KEY`/`UNIQUE INDEX` syntax, inline table and column comments, and various index types.

## Support Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Fully supported and correctly parsed |
| ◐ | Valid SQL that is parsed, but some options/clauses are ignored |
| ✗ | Valid MySQL syntax, but the parser fails to generate output |
| — | Syntax not valid in MySQL |

## Key Capabilities

- **Data Definition**
  - `CREATE TABLE` with full syntax support
  - Data types: parameterized types (e.g., `VARCHAR(255)`, `DECIMAL(10,2)`)
- **Constraints**
  - `PRIMARY KEY` (column-level, table-level, multi-column, with explicit name)
  - `FOREIGN KEY` with `ON UPDATE` / `ON DELETE` actions
  - `UNIQUE`, `UNIQUE KEY`, `UNIQUE INDEX`
  - `CHECK`, `DEFAULT`, `NOT NULL`
- **Auto-increment**
  - `AUTO_INCREMENT` column attribute
- **Indexes**
  - `CREATE INDEX` with BTREE, HASH
  - Table-level indexes in `CREATE TABLE`
  - Function-based indexes
- **Comments**
  - Inline `COMMENT` attribute for tables and columns
- **Data Manipulation**
  - Basic `INSERT` and multi-row `INSERT`

---

## Feature Support Matrix

### `CREATE TABLE`

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `CREATE TABLE` syntax | ✓ | |
| Enumerated data types (ENUM) | ✓ | MySQL uses inline ENUM type |
| Parameterized types `name(...)` | ✓ | e.g., `VARCHAR(255)`, `DECIMAL(10,2)` |
| Array types `name[...]` | — | Not supported in MySQL |
| TEMPORARY tables | ✗ | Tables are completely ignored |
| `CREATE TABLE` AS SELECT | ✗ | |
| Table options (ENGINE, CHARSET, etc.) | ◐ | Options are ignored |

### Constraints

#### `PRIMARY KEY`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `PRIMARY KEY` | ✓ | `id INT PRIMARY KEY` |
| Table-level `PRIMARY KEY` | ✓ | `PRIMARY KEY (id)` |
| Multi-column `PRIMARY KEY` | ✓ | `PRIMARY KEY (a, b)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT pk_name PRIMARY KEY (id)` |
| Index options (USING BTREE, etc.) | ◐ | Options are ignored |

#### `FOREIGN KEY`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `FOREIGN KEY` | ✓ | `col INT REFERENCES other(id)` |
| Table-level `FOREIGN KEY` | ✓ | `FOREIGN KEY (col) REFERENCES other(id)` |
| Multi-column `FOREIGN KEY` | ✓ | `FOREIGN KEY (a, b) REFERENCES other(x, y)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT fk_name FOREIGN KEY ...` |
| `ON UPDATE` action | ✓ | CASCADE, SET NULL, RESTRICT, NO ACTION |
| `ON DELETE` action | ✓ | CASCADE, SET NULL, RESTRICT, NO ACTION |
| Index options | ◐ | Options are ignored |

#### `UNIQUE`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `UNIQUE` | ✓ | `col INT UNIQUE` |
| Table-level `UNIQUE` | ✓ | `UNIQUE (col)` |
| Multi-column `UNIQUE` | ✓ | `UNIQUE (a, b)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT uq_name UNIQUE (col)` |
| Index options | ◐ | Options are ignored |
| NULLS NOT DISTINCT | ✗ | Treats NULLs as equal - parse failure in MySQL |
| `UNIQUE KEY` / `UNIQUE INDEX` | ✓ | MySQL-specific alternative syntax |

#### `CHECK`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `CHECK` | ✓ | `col INT CHECK (col > 0)` |
| Table-level `CHECK` | ✓ | `CHECK (col > 0)` |
| Explicitly named (CONSTRAINT name) | ✓ | Name ignored for column-level checks |
| NOT ENFORCED option | ◐ | Enforcement control is ignored |

#### `DEFAULT`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `DEFAULT` | ✓ | `col INT DEFAULT 0` |
| Table-level `DEFAULT` | — | MySQL only supports column-level `DEFAULT` |
| Function as `DEFAULT` | ✓ | `DEFAULT CURRENT_TIMESTAMP`, `DEFAULT UUID()` |
| Explicitly named `DEFAULT` | — | MySQL doesn't support named `DEFAULT` constraints |

#### `NOT NULL` / NULL

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `NOT NULL` | ✓ | `col INT NOT NULL` |
| NULL (explicitly nullable) | ✓ | `col INT NULL` |
| Table-level `NOT NULL` | — | MySQL only supports column-level `NOT NULL` |
| Constraint options | ◐ | Options are ignored |

### Auto-Increment Columns

| Feature | Status | Notes |
|---------|---------|-------|
| `AUTO_INCREMENT` (column attribute) | ✓ | `id INT AUTO_INCREMENT PRIMARY KEY` |
| `AUTO_INCREMENT` starting value | ◐ | `AUTO_INCREMENT=1000` table option is ignored |
| `SERIAL` (pseudo-type) | — | PostgreSQL syntax - not valid in MySQL |
| `BIGSERIAL` (pseudo-type) | — | PostgreSQL syntax - not valid in MySQL |
| `IDENTITY(seed, increment)` (column property) | — | SQL Server/Snowflake syntax - not valid in MySQL |
| `GENERATED AS IDENTITY` (column property) | — | SQL standard syntax - not valid in MySQL |

### Inline Indexes (in `CREATE TABLE`)

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level indexes | ✗ | Parse failure |
| Table-level indexes (INDEX/KEY) | ✓ | |
| Named indexes | ✓ | |
| Multi-column indexes | ✓ | |
| USING BTREE | ✓ | |
| USING HASH | ✓ | |
| CLUSTERED/NONCLUSTERED | — | SQL Server syntax |
| FULLTEXT index | ◐ | Ignored |
| SPATIAL index | ◐ | Ignored |
| Other index options | ◐ | Ignored |

### Table/Column Comments (in `CREATE TABLE`)

| Feature | Status | Notes |
|---------|---------|-------|
| Table `COMMENT` attribute | ✓ | e.g., `CREATE TABLE t (...) COMMENT 'desc'` |
| Column `COMMENT` attribute | ✓ | e.g., `col INT COMMENT 'desc'` |

---

### `CREATE INDEX`

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `CREATE INDEX` | ✓ | |
| Multi-column index | ✓ | |
| Explicitly named index | ✓ | |
| `UNIQUE` index | ✓ | |
| BTREE index | ✓ | |
| HASH index | ✓ | |
| Function-based index | ✓ | e.g., `CREATE INDEX ON t ((col + 1))` |
| Partial/Filtered index | ✗ | Parse failure |
| INCLUDE columns | — | Not supported in MySQL |
| CLUSTERED/NONCLUSTERED | ◐ | Ignored |
| FULLTEXT index | ◐ | Ignored |
| SPATIAL index | ◐ | Ignored |
| COLLATE | ✗ | Parse failure |
| Index `COMMENT` | ◐ | Ignored |
| NULLS FIRST/LAST | — | Not supported in MySQL |
| ASC/DESC | ◐ | Ignored |

---

### `INSERT` Statements

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `INSERT` ... VALUES | ✓ | |
| Multi-row `INSERT` | ✓ | |
| `INSERT` ... SELECT | ✗ | |
| WITH clause (CTE) | ✗ | |
| Target table alias | — | Not supported in MySQL |
| `INSERT` ... RETURNING | — | Not supported in MySQL |
| `INSERT` ... ON DUPLICATE KEY UPDATE | ◐ | Clause is ignored |
| `INSERT` IGNORE | ◐ | IGNORE is ignored |
| `INSERT` OVERWRITE | — | Snowflake/Hive syntax |
| Multi-table `INSERT` | ✗ | |
| Conditional `INSERT` (WHEN/FIRST/ALL) | ✗ | |

---

### `ALTER TABLE`

| Feature | Status | Notes |
|---------|---------|-------|
| **ADD COLUMN** | | |
| - All column properties | ✗ | |
| **DROP COLUMN** | ✗ | |
| **ALTER COLUMN / MODIFY COLUMN** | | |
| - `COMMENT` | ✗ | |
| - Other modifications | ✗ | |
| **RENAME COLUMN** | ✗ | |
| **ADD CONSTRAINT** | | |
| - Named `CHECK` | ✓ | |
| - Unnamed `CHECK` | ✓ | |
| - Named `UNIQUE` | ✗ | |
| - Unnamed `UNIQUE` | ✗ | |
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
| **ADD INDEX** | ✗ | |

---

### Other DDL Statements

| Feature | Status | Notes |
|---------|---------|-------|
| `DROP TABLE` | ✗ | |
| `DROP INDEX` | ✗ | |
| `ALTER INDEX` | — | Not supported in MySQL |
| `CREATE VIEW` | ✗ | |

---

### Comments (Standalone Statements)

| Feature | Status | Notes |
|---------|---------|-------|
| Standalone table comments | — | Use inline `COMMENT` in `CREATE TABLE` |
| Standalone column comments | — | Use inline `COMMENT` |
| Index comments | ✗ | Parse failure |

---

## Known Limitations

- **TEMPORARY tables**: Completely ignored during parsing
- **Column-level indexes in `CREATE TABLE`**: Parse failure for INDEX/KEY definitions inline with columns
- **`ALTER TABLE` operations**: Limited support; primarily ADD CONSTRAINT (`CHECK`, `FOREIGN KEY`) is functional
- **DDL modification statements**: `DROP TABLE`, `DROP INDEX` not supported
- **`INSERT` ... SELECT**: Subqueries in `INSERT` statements not supported
- **`CREATE VIEW`**: View definitions are not parsed
- **FULLTEXT/SPATIAL indexes**: Parsed but ignored in output

## MySQL-Specific Notes

1. **`AUTO_INCREMENT`**: The MySQL-specific `AUTO_INCREMENT` attribute is correctly recognized and converted to auto-increment columns in DBML
2. **`UNIQUE KEY`/`UNIQUE INDEX`**: Both MySQL syntaxes are supported for defining unique constraints
3. **Inline Comments**: MySQL's `COMMENT` attribute for tables and columns is fully supported (unlike PostgreSQL which uses `COMMENT ON` statements)
4. **Index Types**: `BTREE` and `HASH` index types are supported; `FULLTEXT` and `SPATIAL` are parsed but ignored
5. **Table Engine**: `ENGINE`, `CHARSET`, `COLLATE` and other table options are parsed but ignored in DBML output
6. **ENUM Type**: MySQL's inline `ENUM` type definition is handled differently from PostgreSQL's `CREATE TYPE`
