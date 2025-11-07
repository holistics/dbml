# MSSQL model structure generator

This folder houses the implementation of the MSSQL model structure generator based on the ANTLR4 parser.

This file documents the current features and bugs of this model structure generator.

In the below table, the following notation is used:
  - ✅: Supported.
  - 🤷🏼‍♂️: Invalid SQL in MSSQL.
  - ❓: Valid SQL in MSSQL, the generator can still generate output but it ignores this syntax.
  - ❌: Valid SQL in MSSQL, but the generator fails to generate any output.

| SQL syntax                    | MSSQL         |
|-------------------------------|---------------|
| 1. INSERT statement           |           |
| 1.a. Basic INSERT ... VALUES  | ✅            |
| 1.b. INSERT ... SELECT        | ❌            |
| 1.c. Multi-row INSERT         | ✅            |
| 1.d. Common table expression (WITH clause) | ❌            |
| 1.e. Target table alias       | 🤷🏼‍♂️         |
| 1.f. INSERT … OUTPUT | ❓ (ignore the OUTPUT clause) |
| 1.g. INSERT ... ON CONFLICT (UPSERT)/INSERT ... ON DUPLICATE KEY/INSERT … IGNORE | 🤷🏼‍♂️         |
| 1.h. INSERT OVERWRITE         | 🤷🏼‍♂️         |
| 1.i. Multi-table INSERT       | ❌            |
| 1.j. Conditional multi-table INSERT (WHEN/FIRST/ALL) | ❌            |
| 6. CREATE TABLE               |           |
| 6.a. Basic syntax             | ✅            |
| 6.a.i. Enumerated data type   | 🤷🏼‍♂️         |
| 6.a.ii. Data type of the form name(...) | ✅            |
| 6.a.iii. Data type of the form name\[...\] | 🤷🏼‍♂️         |
| 6.b. PRIMARY KEY              |               |
| 6.b.i. Inline PRIMARY KEY     | ✅            |
| 6.b.ii. Out-of-line PRIMARY KEY | ✅            |
| 6.b.iii. Composite PRIMARY KEY | ✅            |
| 6.b.iv. Named PRIMARY KEY     | ✅            |
| 6.b.v. Other options (deferrable, etc.) | ❓ (ignore the options) |
| 6.c. FOREIGN KEY              |               |
| 6.c.i. Inline FOREIGN KEY     | ❌ (bug) |
| 6.c.ii. Out-of-line FOREIGN KEY | ❌ (bug) |
| 6.c.iii. Composite FOREIGN KEY | ❌ (bug) |
| 6.c.iv. Named FOREIGN KEY     | ❌ (bug) |
| 6.c.v. ON UPDATE              | ❌ (bug) |
| 6.c.vi. ON DELETE             | ❌ (bug) |
| 6.c.vii. Other options (deferrable, etc.) | ❌ (bug) |
| 6.d. UNIQUE                   |               |
| 6.d.i. Inline UNIQUE          | ✅            |
| 6.d.ii. Out-of-line UNIQUE    | ✅            |
| 6.d.iii. Composite UNIQUE     | ✅            |
| 6.d.iv. Named UNIQUE          | ❓ (ignore the name) |
| 6.d.v. Other options (deferrable, etc) | ❓ (ignore the option) |
| 6.d.vi. NULLS NOT DISTINCT    | 🤷🏼‍♂️         |
| 6.d.vii. UNIQUE KEY/UNIQUE INDEX | 🤷🏼‍♂️         |
| 6.e. CHECK                    |               |
| 6.e.i. Inline CHECK           | ❌ (parse fail) |
| 6.e.ii. Out-of-line CHECK     | ❌ (parse fail) |
| 6.e.iii. Named CHECK          | ❌ (parse fail) |
| 6.e.iv. Other options (enforcement control, etc.) | ❌ (parse fail) |
| 6.f. DEFAULT values           |               |
| 6.f.i. Inline DEFAULT         | ✅            |
| 6.f.ii. Out-of-line DEFAULT   | ❌ (Totally ignore) |
| 6.f.iii. Functional DEFAULT   | ✅            |
| 6.f.iv. Named DEFAULT         | ❓ (ignore the name) |
| 6.g. NULL                     | ✅            |
| 6.h. NOT NULL                 |               |
| 6.h.i. Inline NOT NULL        | ✅            |
| 6.h.ii. Out-of-line NOT NULL  | 🤷🏼‍♂️         |
| 6.h.iii. Named NOT NULL       | 🤷🏼‍♂️         |
| 6.h.iv. Other options (deferrable, etc.) | ❓ (Ignore) |
| 6.i. Indexes                  |               |
| 6.i.i. Inline indexes         | 🤷🏼‍♂️ (except for UNIQUE/PRIMARY KEY) |
| 6.i.ii. Out-of-line indexes   | 🤷🏼‍♂️ (except for UNIQUE/PRIMARY KEY) |
| 6.i.iii. Named indexes        | 🤷🏼‍♂️         |
| 6.i.iv. Multi-column indexes  | 🤷🏼‍♂️         |
| 6.i.v. CLUSTERED/NONCLUSTERED | ❓ (ignore) |
| 6.i.vi. FULLTEXT              | 🤷🏼‍♂️         |
| 6.i.vii. SPATIAL              | 🤷🏼‍♂️         |
| 6.i.viii. Other options       | 🤷🏼‍♂️         |
| 6.i.ix. USING HASH/BTREE      | 🤷🏼‍♂️         |
| 6.j. Auto-increment           |               |
| 6.j.i. AUTO_INCREMENT         | 🤷🏼‍♂️         |
| 6.j.ii. SERIAL/BIG SERIAL     | 🤷🏼‍♂️         |
| 6.j.iii. IDENTITY             | ✅            |
| 6.j.iv. Increment range       | ✅            |
| 6.j.v. GENERATED ... AS IDENTITY | ❌ (parse fail) |
| 6.k. Computed column          | ❓            |
| 6.l. TEMPORARY tables         | ✅ (indication of temporary table via # prefix) |
| 6.m. CREATE TABLE AS SELECT (CTAS) | ❌            |
| 6.n. Comments                 |               |
| 6.n.i. Table comments         | 🤷🏼‍♂️         |
| 6.n.ii. Column comments       | 🤷🏼‍♂️         |
| 6.o. Other options (inheritance, UNLOGGED, partition, collate, etc.) | ❓            |
| 7. ALTER TABLE                |           |
| 7.a. ADD COLUMN               |               |
| 7.a.i. Type                   | ❌            |
| 7.a.ii. DEFAULT               | ❌            |
| 7.a.iii. NOT NULL             | ❌            |
| 7.a.iv. NULL                  | ❌            |
| 7.a.v. CHECK                  | ❌            |
| 7.a.vi. UNIQUE                | ❌            |
| 7.a.vii. FOREIGN KEY          | ❌ (parse fail) |
| 7.a.viii. PRIMARY KEY         | ❌            |
| 7.a.ix. AUTOINCREMENT/SERIAL/BIGSERIAL/IDENTITY/GENERATED AS IDENTITY | ❌            |
| 7.a.x. Computed column        | ❌            |
| 7.b. DROP COLUMN              | ❌            |
| 7.c. ALTER COLUMN / MODIFY COLUMN |               |
| 7.c.i. COMMENT                | 🤷🏼‍♂️         |
| 7.c.ii. Others                | ❌            |
| 7.d. RENAME COLUMN            | ❌            |
| 7.e. ADD CONSTRAINT           |               |
| 7.e.i. DEFAULT                | ✅ (ignore name) |
| 7.e.ii. NOT NULL              | ❌            |
| 7.e.iii. NULL                 | ❌            |
| 7.e.iv. named CHECK           | ✅            |
| 7.e.v. unnamed CHECK          | ✅            |
| 7.e.vi. named UNIQUE          | ✅            |
| 7.e.vii. unnamed UNIQUE       | ✅            |
| 7.e.viii. named PRIMARY KEY   | ✅            |
| 7.e.ix. unnamed PRIMARY KEY   | ✅            |
| 7.e.x. named FOREIGN KEY      | ✅            |
| 7.e.xi. unnamed FOREIGN KEY   | ✅            |
| 7.g. DROP CONSTRAINT          | ❌            |
| 7.h. ALTER CONSTRAINT         | ❌            |
| 7.i. RENAME TABLE             | ❌            |
| 7.j. SET SCHEMA               | ❌            |
| 7.k. ALTER INDEX              | ❌            |
| 7.l. DROP INDEX               | ❌            |
| 7.m. SET COMMENT/COMMENT =    | 🤷🏼‍♂️         |
| 7.n. ADD INDEX                | ❌            |
| 8. DROP TABLE                 |               |
| 8.a. Basic syntax             | ❌            |
| 9. CREATE INDEX               |               |
| 9.a. Basic syntax             | ✅            |
| 9.b. Composite index          | ✅            |
| 9.c. Named index              | ✅            |
| 9.d. UNIQUE index             | ✅            |
| 9.e. Partial/Filtered index   | ❓ (ignore) |
| 9.f. BTREE/HASH/GIST/BRIN/… index | ❌ (parse fail) |
| 9.g. INCLUDE columns          | ❓ (ignore) |
| 9.h. CLUSTERED/NONCLUSTERED   | ❓ (ignore) |
| 9.i. Functional index         | 🤷🏼‍♂️ (However, the MSSQL exporter is currently exporting this syntax) |
| 9.j. FULLTEXT/SPATIAL index   | ❌ (parse fail) |
| 9.k. COLLATE                  | 🤷🏼‍♂️         |
| 9.l. COMMENT                  | 🤷🏼‍♂️         |
| 9.m. NULLS LAST/FIRST         | 🤷🏼‍♂️         |
| 9.n. ASC/DESC                 | ❓ (ignore) |
| 10. DROP INDEX                |           |
| 10.a. Basic syntax            | ❌            |
| 11. ALTER INDEX               |           |
| 11.a. RENAME                  | ❌            |
| 11.b. ALTER COLUMN            | ❌            |
| 12. CREATE VIEW               |           |
| 12.a. Basic syntax            | ❌            |
| 13. Comment                   |               |
| 13.a. Table comments          | ✅ (but unreliable) |
| 13.b. Column comments         | ✅ (but unreliable) |
| 13.c. COMMENT … IS NULL       | ✅ (but unreliable) |
| 13.d. Index comments          | ❌            |
