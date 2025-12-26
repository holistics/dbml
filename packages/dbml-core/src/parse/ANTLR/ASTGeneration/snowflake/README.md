# Snowflake SQL Parser Support

> Comprehensive documentation for the Snowflake model structure generator based on the ANTLR4 parser.

## Overview

This module provides SQL parsing capabilities for Snowflake databases, enabling conversion of Snowflake DDL statements to DBML format. The parser supports Snowflake-specific syntax including `IDENTITY` columns with increment ranges. Note that Snowflake, as a cloud data warehouse, does not support traditional indexes, and the parser has known issues with `FOREIGN KEY` and `CHECK` constraints.

## Support Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Fully supported and correctly parsed |
| ◐ | Valid SQL that is parsed, but some options/clauses are ignored |
| ✗ | Valid Snowflake syntax, but the parser fails to generate output |
| — | Syntax not valid in Snowflake |

## Key Capabilities

- **Data Definition**
  - `CREATE TABLE` with basic syntax support
  - Data types: parameterized types (e.g., `VARCHAR(255)`, `NUMBER(10,2)`)
- **Constraints**
  - `PRIMARY KEY` (column-level, table-level, multi-column, with explicit name)
  - `UNIQUE` (column-level, table-level, multi-column)
  - `DEFAULT`, `NOT NULL`
  - `FOREIGN KEY`: **Not Supported** (known bug)
  - `CHECK`: **Not Supported** (parse failure)
- **Auto-increment**
  - `IDENTITY` with increment range (e.g., `IDENTITY(1,1)`)
- **Indexes**
  - N/A (Snowflake does not support user-defined indexes)
- **Comments**
  - Table comments only (column comments not supported)
- **Data Manipulation**
  - Multi-row `INSERT` only

---

## Feature Support Matrix

### `CREATE TABLE`

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `CREATE TABLE` syntax | ✓ | |
| Enumerated data types | — | Not supported in Snowflake |
| Parameterized types `name(...)` | ✓ | e.g., `VARCHAR(255)`, `NUMBER(10,2)` |
| Array types `name[...]` | — | Snowflake uses ARRAY type differently |
| TEMPORARY tables | ◐ | Parsed but no indication of temporary status |
| `CREATE TABLE` AS SELECT | ✗ | |
| Table options (CLUSTER BY, etc.) | ◐ | Options are ignored |

### Constraints

#### `PRIMARY KEY`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `PRIMARY KEY` | ✓ | `id INT PRIMARY KEY` |
| Table-level `PRIMARY KEY` | ✓ | `PRIMARY KEY (id)` |
| Multi-column `PRIMARY KEY` | ✓ | `PRIMARY KEY (a, b)` |
| Explicitly named (CONSTRAINT name) | ✓ | `CONSTRAINT pk_name PRIMARY KEY (id)` |
| RELY / NORELY options | ◐ | Constraint enforcement hints are ignored |

#### `FOREIGN KEY`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `FOREIGN KEY` | ✗ | Known bug - produces undefined error |
| Table-level `FOREIGN KEY` | ✗ | Known bug - produces undefined error |
| Multi-column `FOREIGN KEY` | ✗ | Known bug - produces undefined error |
| Explicitly named (CONSTRAINT name) | ✗ | Known bug - produces undefined error |
| `ON UPDATE` action | ✗ | Known bug - produces undefined error |
| `ON DELETE` action | ✗ | Known bug - produces undefined error |
| Constraint options | ✗ | Known bug - produces undefined error |

#### `UNIQUE`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `UNIQUE` | ✓ | `col INT UNIQUE` |
| Table-level `UNIQUE` | ✓ | `UNIQUE (col)` |
| Multi-column `UNIQUE` | ✓ | `UNIQUE (a, b)` |
| Explicitly named (CONSTRAINT name) | ◐ | Name is ignored in output |
| Constraint options | ◐ | Options are ignored |
| NULLS NOT DISTINCT | — | Not valid in Snowflake |
| `UNIQUE KEY`/`UNIQUE INDEX` | — | MySQL syntax - not valid in Snowflake |

#### `CHECK`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `CHECK` | ✗ | `CHECK (col > 0)` - parse failure |
| Table-level `CHECK` | ✗ | Parse failure |
| Explicitly named (CONSTRAINT name) | ✗ | Parse failure |
| Enforcement options | ✗ | Parse failure |

#### `DEFAULT`

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `DEFAULT` | ✓ | `col INT DEFAULT 0` |
| Table-level `DEFAULT` | ✗ | Parse failure |
| Function as `DEFAULT` | ✓ | `DEFAULT CURRENT_TIMESTAMP()` |
| Explicitly named `DEFAULT` | ◐ | Name is ignored in output |

#### `NOT NULL` / NULL

| Feature | Status | Notes |
|---------|---------|-------|
| Column-level `NOT NULL` | ✓ | |
| NULL attribute | ✓ | |
| Table-level `NOT NULL` | — | |
| Constraint options | ◐ | Options are ignored |

### Auto-Increment Columns

| Feature | Status | Notes |
|---------|---------|-------|
| `IDENTITY` (column property) | ✓ | `id INT IDENTITY(1,1)` |
| Increment range | ✓ | `IDENTITY(start, increment)` syntax |
| `AUTO_INCREMENT` (column attribute) | — | MySQL syntax - not valid in Snowflake |
| `SERIAL` (pseudo-type) | — | PostgreSQL syntax - not valid in Snowflake |
| `BIGSERIAL` (pseudo-type) | — | PostgreSQL syntax - not valid in Snowflake |
| `GENERATED AS IDENTITY` (column property) | ✗ | SQL standard syntax - parse failure |

### Inline Indexes (in `CREATE TABLE`)

| Feature | Status | Notes |
|---------|---------|-------|
| All index features | — | Snowflake does not support user-defined indexes |

### Table/Column Comments (in `CREATE TABLE`)

| Feature | Status | Notes |
|---------|---------|-------|
| Table `COMMENT` attribute | ✓ | |
| Column `COMMENT` attribute | ✗ | |

---

### `CREATE INDEX`

| Feature | Status | Notes |
|---------|---------|-------|
| All index features | — | Snowflake does not support `CREATE INDEX` |

---

### `INSERT` Statements

| Feature | Status | Notes |
|---------|---------|-------|
| Basic `INSERT` ... VALUES | ✗ | |
| Multi-row `INSERT` | ✓ | |
| `INSERT` ... SELECT | ✗ | |
| WITH clause (CTE) | ✗ | |
| Target table alias | — | |
| `INSERT` ... RETURNING | — | |
| `INSERT` OVERWRITE | ✗ | |
| Multi-table `INSERT` | ✗ | |
| Conditional `INSERT` (WHEN/FIRST/ALL) | ✗ | |

---

### `ALTER TABLE`

| Feature | Status | Notes |
|---------|---------|-------|
| **ADD COLUMN** | | |
| - All column properties | ✗ | |
| **DROP COLUMN** | ✗ | |
| **ALTER COLUMN / MODIFY** | | |
| - `COMMENT` | ✗ | |
| - Other modifications | ✗ | |
| **RENAME COLUMN** | ✗ | |
| **ADD CONSTRAINT** | | |
| - Named `CHECK` | — | Snowflake uses SET/UNSET for constraints |
| - Unnamed `CHECK` | — | |
| - Named `UNIQUE` | ◐ | Name is ignored |
| - Unnamed `UNIQUE` | ✓ | |
| - Named `PRIMARY KEY` | ✗ | |
| - Unnamed `PRIMARY KEY` | ✗ | |
| - Named `FOREIGN KEY` | ◐ | Name is ignored |
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
| `DROP INDEX` | — | No indexes in Snowflake |
| `ALTER INDEX` | — | No indexes in Snowflake |
| `CREATE VIEW` | ✗ | |

---

### Comments (Standalone Statements)

| Feature | Status | Notes |
|---------|---------|-------|
| `COMMENT ON TABLE` | ✗ | |
| `COMMENT ON COLUMN` | ✗ | |
| COMMENT ... IS NULL | — | Use `ALTER TABLE ... SET/UNSET COMMENT` |

---

## Known Limitations

- **`FOREIGN KEY` constraints**: All `FOREIGN KEY` definitions fail with undefined errors
- **`CHECK` constraints**: All `CHECK` constraint definitions fail to parse
- **Column comments**: Column-level comments are not supported
- **Basic `INSERT`**: Single-row `INSERT` without parentheses may fail; use multi-row `INSERT` syntax
- **`ALTER TABLE` operations**: Very limited support
- **`CREATE VIEW`**: View definitions are not parsed
- **Indexes**: Not applicable to Snowflake (cloud DW architecture)
- **`GENERATED AS IDENTITY`**: SQL standard syntax not supported; use `IDENTITY(start, increment)` instead

## Snowflake-Specific Notes

1. **`IDENTITY` Columns**: Snowflake uses `IDENTITY(start, increment)` syntax for auto-increment, e.g., `IDENTITY(1,1)`. This is supported with increment range
2. **No Indexes**: Snowflake is a cloud data warehouse that does not support traditional indexes. All index-related features are marked N/A
3. **`FOREIGN KEY` Issues**: There is a known bug where all `FOREIGN KEY` constraint definitions produce `(undefined:undefined) undefined` errors
4. **`CHECK` Constraints**: `CHECK` constraints are valid in Snowflake SQL but currently fail to parse
5. **Comments**: Use inline `COMMENT` in `CREATE TABLE` for table comments. Column comments have parsing issues
6. **Data Types**: Snowflake has its own type system; common types like `VARCHAR`, `NUMBER`, `TIMESTAMP` are fully supported
7. **Constraint Enforcement**: Snowflake's constraint options like `RELY`/`NORELY`, `ENFORCED`/`NOT ENFORCED` are parsed but ignored
