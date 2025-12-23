# Snowflake SQL Parser Support

> Comprehensive documentation for the Snowflake model structure generator based on the ANTLR4 parser.

## Overview

This module provides SQL parsing capabilities for Snowflake databases, enabling conversion of Snowflake DDL statements to DBML format. The parser supports Snowflake-specific syntax including `IDENTITY` columns with increment ranges. Note that Snowflake, as a cloud data warehouse, does not support traditional indexes, and the parser has known issues with `FOREIGN KEY` and `CHECK` constraints.

## Support Legend

| Symbol | Meaning |
|--------|---------|
| Supported | Feature is fully supported and correctly parsed |
| Partial | Valid SQL that is parsed, but some options/clauses are ignored in the output |
| Not Supported | Valid Snowflake syntax, but the parser fails to generate output |
| N/A | Syntax not valid in Snowflake |

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

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `CREATE TABLE` syntax | Supported | |
| Enumerated data types | N/A | Not supported in Snowflake |
| Parameterized types `name(...)` | Supported | e.g., `VARCHAR(255)`, `NUMBER(10,2)` |
| Array types `name[...]` | N/A | Snowflake uses ARRAY type differently |
| TEMPORARY tables | Partial | Parsed but no indication of temporary status |
| `CREATE TABLE` AS SELECT | Not Supported | |
| Table options (CLUSTER BY, etc.) | Partial | Options are ignored |

### Constraints

#### `PRIMARY KEY`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `PRIMARY KEY` | Supported | `id INT PRIMARY KEY` |
| Table-level `PRIMARY KEY` | Supported | `PRIMARY KEY (id)` |
| Multi-column `PRIMARY KEY` | Supported | `PRIMARY KEY (a, b)` |
| Explicitly named (CONSTRAINT name) | Supported | `CONSTRAINT pk_name PRIMARY KEY (id)` |
| RELY / NORELY options | Partial | Constraint enforcement hints are ignored |

#### `FOREIGN KEY`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `FOREIGN KEY` | Not Supported | Known bug - produces undefined error |
| Table-level `FOREIGN KEY` | Not Supported | Known bug - produces undefined error |
| Multi-column `FOREIGN KEY` | Not Supported | Known bug - produces undefined error |
| Explicitly named (CONSTRAINT name) | Not Supported | Known bug - produces undefined error |
| `ON UPDATE` action | Not Supported | Known bug - produces undefined error |
| `ON DELETE` action | Not Supported | Known bug - produces undefined error |
| Constraint options | Not Supported | Known bug - produces undefined error |

#### `UNIQUE`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `UNIQUE` | Supported | `col INT UNIQUE` |
| Table-level `UNIQUE` | Supported | `UNIQUE (col)` |
| Multi-column `UNIQUE` | Supported | `UNIQUE (a, b)` |
| Explicitly named (CONSTRAINT name) | Partial | Name is ignored in output |
| Constraint options | Partial | Options are ignored |
| NULLS NOT DISTINCT | N/A | Not valid in Snowflake |
| `UNIQUE KEY`/`UNIQUE INDEX` | N/A | MySQL syntax - not valid in Snowflake |

#### `CHECK`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `CHECK` | Not Supported | `CHECK (col > 0)` - parse failure |
| Table-level `CHECK` | Not Supported | Parse failure |
| Explicitly named (CONSTRAINT name) | Not Supported | Parse failure |
| Enforcement options | Not Supported | Parse failure |

#### `DEFAULT`

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `DEFAULT` | Supported | `col INT DEFAULT 0` |
| Table-level `DEFAULT` | Not Supported | Parse failure |
| Function as `DEFAULT` | Supported | `DEFAULT CURRENT_TIMESTAMP()` |
| Explicitly named `DEFAULT` | Partial | Name is ignored in output |

#### `NOT NULL` / NULL

| Feature | Support | Notes |
|---------|---------|-------|
| Column-level `NOT NULL` | Supported | |
| NULL attribute | Supported | |
| Table-level `NOT NULL` | N/A | |
| Constraint options | Partial | Options are ignored |

### Auto-Increment Columns

| Feature | Support | Notes |
|---------|---------|-------|
| `IDENTITY` (column property) | Supported | `id INT IDENTITY(1,1)` |
| Increment range | Supported | `IDENTITY(start, increment)` syntax |
| `AUTO_INCREMENT` (column attribute) | N/A | MySQL syntax - not valid in Snowflake |
| `SERIAL` (pseudo-type) | N/A | PostgreSQL syntax - not valid in Snowflake |
| `BIGSERIAL` (pseudo-type) | N/A | PostgreSQL syntax - not valid in Snowflake |
| `GENERATED AS IDENTITY` (column property) | Not Supported | SQL standard syntax - parse failure |

### Inline Indexes (in `CREATE TABLE`)

| Feature | Support | Notes |
|---------|---------|-------|
| All index features | N/A | Snowflake does not support user-defined indexes |

### Table/Column Comments (in `CREATE TABLE`)

| Feature | Support | Notes |
|---------|---------|-------|
| Table `COMMENT` attribute | Supported | |
| Column `COMMENT` attribute | Not Supported | |

---

### `CREATE INDEX`

| Feature | Support | Notes |
|---------|---------|-------|
| All index features | N/A | Snowflake does not support `CREATE INDEX` |

---

### `INSERT` Statements

| Feature | Support | Notes |
|---------|---------|-------|
| Basic `INSERT` ... VALUES | Not Supported | |
| Multi-row `INSERT` | Supported | |
| `INSERT` ... SELECT | Not Supported | |
| WITH clause (CTE) | Not Supported | |
| Target table alias | N/A | |
| `INSERT` ... RETURNING | N/A | |
| `INSERT` OVERWRITE | Not Supported | |
| Multi-table `INSERT` | Not Supported | |
| Conditional `INSERT` (WHEN/FIRST/ALL) | Not Supported | |

---

### `ALTER TABLE`

| Feature | Support | Notes |
|---------|---------|-------|
| **ADD COLUMN** | | |
| - All column properties | Not Supported | |
| **DROP COLUMN** | Not Supported | |
| **ALTER COLUMN / MODIFY** | | |
| - `COMMENT` | Not Supported | |
| - Other modifications | Not Supported | |
| **RENAME COLUMN** | Not Supported | |
| **ADD CONSTRAINT** | | |
| - Named `CHECK` | N/A | Snowflake uses SET/UNSET for constraints |
| - Unnamed `CHECK` | N/A | |
| - Named `UNIQUE` | Partial | Name is ignored |
| - Unnamed `UNIQUE` | Supported | |
| - Named `PRIMARY KEY` | Not Supported | |
| - Unnamed `PRIMARY KEY` | Not Supported | |
| - Named `FOREIGN KEY` | Partial | Name is ignored |
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
| `DROP INDEX` | N/A | No indexes in Snowflake |
| `ALTER INDEX` | N/A | No indexes in Snowflake |
| `CREATE VIEW` | Not Supported | |

---

### Comments (Standalone Statements)

| Feature | Support | Notes |
|---------|---------|-------|
| `COMMENT ON TABLE` | Not Supported | |
| `COMMENT ON COLUMN` | Not Supported | |
| COMMENT ... IS NULL | N/A | Use `ALTER TABLE ... SET/UNSET COMMENT` |

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
