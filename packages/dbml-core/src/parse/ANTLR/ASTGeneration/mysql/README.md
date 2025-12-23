# MySQL SQL Parser Support

> Comprehensive documentation for the MySQL model structure generator based on the ANTLR4 parser.

## Overview

This module provides SQL parsing capabilities for MySQL databases, enabling conversion of MySQL DDL statements to DBML format. The parser supports MySQL-specific syntax including `AUTO_INCREMENT` columns, `UNIQUE KEY`/`UNIQUE INDEX` syntax, inline table and column comments, and various index types.

## Support Legend

| Symbol | Meaning |
|--------|---------|
| Supported | Feature is fully supported and correctly parsed |
| Partial | Valid SQL that is parsed, but some options/clauses are ignored in the output |
| Not Supported | Valid MySQL syntax, but the parser fails to generate output |
| N/A | Syntax not valid in MySQL |

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

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `CREATE TABLE` syntax | Supported | |
| Enumerated data types (ENUM) | Supported | MySQL uses inline ENUM type |
| Parameterized types `name(...)` | Supported | e.g., `VARCHAR(255)`, `DECIMAL(10,2)` |
| Array types `name[...]` | N/A | Not supported in MySQL |
| TEMPORARY tables | Not Supported | Tables are completely ignored |
| `CREATE TABLE` AS SELECT | Not Supported | |
| Table options (ENGINE, CHARSET, etc.) | Partial | Options are ignored |

### Constraints

#### `PRIMARY KEY`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `PRIMARY KEY` | Supported | `id INT PRIMARY KEY` |
| Table-level `PRIMARY KEY` | Supported | `PRIMARY KEY (id)` |
| Multi-column `PRIMARY KEY` | Supported | `PRIMARY KEY (a, b)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT pk_name PRIMARY KEY (id)` |
| Index options (USING BTREE, etc.) | Partial | Options are ignored |

#### `FOREIGN KEY`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `FOREIGN KEY` | Supported | `col INT REFERENCES other(id)` |
| Table-level `FOREIGN KEY` | Supported | `FOREIGN KEY (col) REFERENCES other(id)` |
| Multi-column `FOREIGN KEY` | Supported | `FOREIGN KEY (a, b) REFERENCES other(x, y)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT fk_name FOREIGN KEY ...` |
| `ON UPDATE` action | Supported | CASCADE, SET NULL, RESTRICT, NO ACTION |
| `ON DELETE` action | Supported | CASCADE, SET NULL, RESTRICT, NO ACTION |
| Index options | Partial | Options are ignored |

#### `UNIQUE`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `UNIQUE` | Supported | `col INT UNIQUE` |
| Table-level `UNIQUE` | Supported | `UNIQUE (col)` |
| Multi-column `UNIQUE` | Supported | `UNIQUE (a, b)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT uq_name UNIQUE (col)` |
| Index options | Partial | Options are ignored |
| NULLS NOT DISTINCT | Not Supported | Treats NULLs as equal - parse failure in MySQL |
| `UNIQUE KEY` / `UNIQUE INDEX` | Supported | MySQL-specific alternative syntax |

#### `CHECK`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `CHECK` | Supported | `col INT CHECK (col > 0)` |
| Table-level `CHECK` | Supported | `CHECK (col > 0)` |
| Explicitly named (CONSTRAINT name) | Supported | Name ignored for column-level checks |
| NOT ENFORCED option | Partial | Enforcement control is ignored |

#### `DEFAULT`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `DEFAULT` | Supported | `col INT DEFAULT 0` |
| Table-level `DEFAULT` | N/A | MySQL only supports column-level `DEFAULT` |
| Function as `DEFAULT` | Supported | `DEFAULT CURRENT_TIMESTAMP`, `DEFAULT UUID()` |
| Explicitly named `DEFAULT` | N/A | MySQL doesn't support named `DEFAULT` constraints |

#### `NOT NULL` / NULL

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `NOT NULL` | Supported | `col INT NOT NULL` |
| NULL (explicitly nullable) | Supported | `col INT NULL` |
| Table-level `NOT NULL` | N/A | MySQL only supports column-level `NOT NULL` |
| Constraint options | Partial | Options are ignored |

### Auto-Increment Columns

| Feature | Support | Notes |
|---------|---------|-------|
| `AUTO_INCREMENT` (column attribute) | Supported | `id INT AUTO_INCREMENT PRIMARY KEY` |
| `AUTO_INCREMENT` starting value | Partial | `AUTO_INCREMENT=1000` table option is ignored |
| `SERIAL` (pseudo-type) | N/A | PostgreSQL syntax - not valid in MySQL |
| `BIGSERIAL` (pseudo-type) | N/A | PostgreSQL syntax - not valid in MySQL |
| `IDENTITY(seed, increment)` (column property) | N/A | SQL Server/Snowflake syntax - not valid in MySQL |
| `GENERATED AS IDENTITY` (column property) | N/A | SQL standard syntax - not valid in MySQL |

### Inline Indexes (in `CREATE TABLE`)

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level indexes | Not Supported | Parse failure |
| Table-level indexes (INDEX/KEY) | Supported | |
| Named indexes | Supported | |
| Multi-column indexes | Supported | |
| USING BTREE | Supported | |
| USING HASH | Supported | |
| CLUSTERED/NONCLUSTERED | N/A | SQL Server syntax |
| FULLTEXT index | Partial | Ignored |
| SPATIAL index | Partial | Ignored |
| Other index options | Partial | Ignored |

### Table/Column Comments (in `CREATE TABLE`)

| Feature | Support | Notes |
|---------|---------|-------|
| Table `COMMENT` attribute | Supported | e.g., `CREATE TABLE t (...) COMMENT 'desc'` |
| Column `COMMENT` attribute | Supported | e.g., `col INT COMMENT 'desc'` |

---

### `CREATE INDEX`

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `CREATE INDEX` | Supported | |
| Multi-column index | Supported | |
| Explicitly named index | Supported | |
| `UNIQUE` index | Supported | |
| BTREE index | Supported | |
| HASH index | Supported | |
| Function-based index | Supported | e.g., `CREATE INDEX ON t ((col + 1))` |
| Partial/Filtered index | Not Supported | Parse failure |
| INCLUDE columns | N/A | Not supported in MySQL |
| CLUSTERED/NONCLUSTERED | Partial | Ignored |
| FULLTEXT index | Partial | Ignored |
| SPATIAL index | Partial | Ignored |
| COLLATE | Not Supported | Parse failure |
| Index `COMMENT` | Partial | Ignored |
| NULLS FIRST/LAST | N/A | Not supported in MySQL |
| ASC/DESC | Partial | Ignored |

---

### `INSERT` Statements

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `INSERT` ... VALUES | Supported | |
| Multi-row `INSERT` | Supported | |
| `INSERT` ... SELECT | Not Supported | |
| WITH clause (CTE) | Not Supported | |
| Target table alias | N/A | Not supported in MySQL |
| `INSERT` ... RETURNING | N/A | Not supported in MySQL |
| `INSERT` ... ON DUPLICATE KEY UPDATE | Partial | Clause is ignored |
| `INSERT` IGNORE | Partial | IGNORE is ignored |
| `INSERT` OVERWRITE | N/A | Snowflake/Hive syntax |
| Multi-table `INSERT` | Not Supported | |
| Conditional `INSERT` (WHEN/FIRST/ALL) | Not Supported | |

---

### `ALTER TABLE`

| Feature | Support | Notes |
|---------|---------|-------|
| **ADD COLUMN** | | |
| - All column properties | Not Supported | |
| **DROP COLUMN** | Not Supported | |
| **ALTER COLUMN / MODIFY COLUMN** | | |
| - `COMMENT` | Not Supported | |
| - Other modifications | Not Supported | |
| **RENAME COLUMN** | Not Supported | |
| **ADD CONSTRAINT** | | |
| - Named `CHECK` | Supported | |
| - Unnamed `CHECK` | Supported | |
| - Named `UNIQUE` | Not Supported | |
| - Unnamed `UNIQUE` | Not Supported | |
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
| **ADD INDEX** | Not Supported | |

---

### Other DDL Statements

| Feature | Support | Notes |
|---------|---------|-------|
| `DROP TABLE` | Not Supported | |
| `DROP INDEX` | Not Supported | |
| `ALTER INDEX` | N/A | Not supported in MySQL |
| `CREATE VIEW` | Not Supported | |

---

### Comments (Standalone Statements)

| Feature | Support | Notes |
|---------|---------|-------|
| Standalone table comments | N/A | Use inline `COMMENT` in `CREATE TABLE` |
| Standalone column comments | N/A | Use inline `COMMENT` |
| Index comments | Not Supported | Parse failure |

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
