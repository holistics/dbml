-- Test RENAME TABLE and TRUNCATE TABLE statements

-- Create tables for testing
CREATE TABLE old_table (id INT PRIMARY KEY, data VARCHAR(100));
CREATE TABLE table1 (id INT PRIMARY KEY);
CREATE TABLE table2 (id INT PRIMARY KEY);
CREATE TABLE table3 (id INT PRIMARY KEY);

-- Simple RENAME TABLE
RENAME TABLE old_table TO new_table;

-- RENAME TABLE with database prefix
RENAME TABLE mydb.old_table TO mydb.new_table;

-- RENAME TABLE to different database
RENAME TABLE db1.table1 TO db2.table1;

-- RENAME TABLE with backticks
RENAME TABLE `old_table` TO `new_table`;

-- RENAME TABLE with backticks in names
RENAME TABLE `old-table` TO `new-table`;

-- RENAME TABLE with reserved word
RENAME TABLE `select` TO `new_select`;

-- RENAME multiple tables in one statement
RENAME TABLE
  table1 TO renamed_table1,
  table2 TO renamed_table2,
  table3 TO renamed_table3;

-- RENAME with mix of formats
RENAME TABLE
  simple_table TO new_simple,
  `table-with-dashes` TO `new-table-dashes`,
  mydb.prefixed_table TO mydb.new_prefixed;

-- RENAME table to same name in different database
RENAME TABLE db1.users TO db2.users;

-- RENAME with backticks and database prefix
RENAME TABLE `mydb`.`old_table` TO `mydb`.`new_table`;

-- Multiple renames with database prefixes
RENAME TABLE
  db1.t1 TO db1.new_t1,
  db2.t2 TO db2.new_t2,
  db3.t3 TO db3.new_t3;

-- Edge case: Rename table to backticked name
RENAME TABLE normal_table TO `special-name`;

-- Edge case: Swap table names (requires multiple renames)
CREATE TABLE table_a (id INT);
CREATE TABLE table_b (id INT);
CREATE TABLE temp_table (id INT);

RENAME TABLE table_a TO temp_table;
RENAME TABLE table_b TO table_a;
RENAME TABLE temp_table TO table_b;

-- Or in one statement:
RENAME TABLE
  table_a TO temp_swap,
  table_b TO table_a,
  temp_swap TO table_b;

-- Edge case: Very long table names
RENAME TABLE very_long_old_table_name_at_maximum TO very_long_new_table_name_at_maximum;

-- Edge case: Table with numbers
RENAME TABLE table123 TO table456;
RENAME TABLE t1 TO t2;

-- Edge case: Table name starting with number (quoted)
RENAME TABLE `123table` TO `456table`;

-- Edge case: Special characters in names
RENAME TABLE `table@test` TO `table@prod`;
RENAME TABLE `table#dev` TO `table#live`;

-- Edge case: Unicode in names (if supported)
RENAME TABLE `table_用户` TO `table_ユーザー`;

-- RENAME with single character names
RENAME TABLE a TO b;
RENAME TABLE x TO y;

-- RENAME table back and forth
RENAME TABLE users TO temp_users;
RENAME TABLE temp_users TO users;

-- RENAME multiple tables with various database contexts
RENAME TABLE
  local_table TO new_local_table,
  db1.remote_table TO db1.new_remote_table,
  db2.another_table TO db3.moved_table;

-- Edge case: RENAME preserves table structure
CREATE TABLE source_with_indexes (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  INDEX idx_name (name),
  UNIQUE KEY uk_email (email)
);

RENAME TABLE source_with_indexes TO target_with_indexes;

-- ===== TRUNCATE TABLE =====

-- Create tables for TRUNCATE testing
CREATE TABLE truncate_test (id INT PRIMARY KEY, data VARCHAR(100));
CREATE TABLE truncate_test2 (id INT PRIMARY KEY);

-- Simple TRUNCATE TABLE
TRUNCATE TABLE truncate_test;

-- TRUNCATE TABLE (TABLE keyword optional)
TRUNCATE truncate_test2;

-- TRUNCATE TABLE with database prefix
TRUNCATE TABLE mydb.test_table;

-- TRUNCATE without TABLE keyword and with prefix
TRUNCATE mydb.another_table;

-- TRUNCATE TABLE with backticks
TRUNCATE TABLE `truncate_test`;

-- TRUNCATE TABLE with backticks in name
TRUNCATE TABLE `table-with-dashes`;

-- TRUNCATE TABLE with reserved word
TRUNCATE TABLE `select`;

-- TRUNCATE TABLE with backticks and database prefix
TRUNCATE TABLE `mydb`.`test_table`;

-- Edge case: TRUNCATE TABLE vs DELETE (TRUNCATE is faster, resets AUTO_INCREMENT)
CREATE TABLE truncate_vs_delete (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data VARCHAR(100)
);

INSERT INTO truncate_vs_delete (data) VALUES ('test1'), ('test2'), ('test3');
TRUNCATE TABLE truncate_vs_delete;
-- AUTO_INCREMENT counter is reset to 1

-- TRUNCATE TABLE with foreign key constraints (will fail if referenced)
CREATE TABLE parent_trunc (id INT PRIMARY KEY);
CREATE TABLE child_trunc (
  id INT PRIMARY KEY,
  parent_id INT,
  FOREIGN KEY (parent_id) REFERENCES parent_trunc(id)
);

-- This would normally fail:
-- TRUNCATE TABLE parent_trunc;

-- But works if you disable FK checks:
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE TABLE parent_trunc;
SET FOREIGN_KEY_CHECKS=1;

-- TRUNCATE TABLE with partitions (truncates all partitions)
CREATE TABLE partitioned_truncate (
  id INT,
  created_year INT,
  PRIMARY KEY (id, created_year)
) PARTITION BY RANGE (created_year) (
  PARTITION p2020 VALUES LESS THAN (2021),
  PARTITION p2021 VALUES LESS THAN (2022),
  PARTITION p2022 VALUES LESS THAN (2023)
);

TRUNCATE TABLE partitioned_truncate;

-- Edge case: TRUNCATE temporary table
CREATE TEMPORARY TABLE temp_truncate (id INT, data VARCHAR(100));
INSERT INTO temp_truncate VALUES (1, 'test');
TRUNCATE TABLE temp_truncate;

-- Edge case: TRUNCATE table with triggers
CREATE TABLE table_with_trigger_trunc (
  id INT PRIMARY KEY,
  data VARCHAR(100)
);

CREATE TRIGGER before_insert_trunc
BEFORE INSERT ON table_with_trigger_trunc
FOR EACH ROW
SET NEW.data = UPPER(NEW.data);

-- TRUNCATE doesn't fire triggers
TRUNCATE TABLE table_with_trigger_trunc;

-- Edge case: Very long table name
TRUNCATE TABLE very_long_table_name_for_truncate_at_maximum_length_limit;

-- Edge case: Table with numbers
TRUNCATE TABLE table123;

-- Edge case: Table starting with number (quoted)
TRUNCATE TABLE `123table`;

-- Edge case: Special characters
TRUNCATE TABLE `table@test`;

-- Edge case: Single character table name
TRUNCATE TABLE t;

-- Multiple TRUNCATE statements in sequence
CREATE TABLE t1 (id INT);
CREATE TABLE t2 (id INT);
CREATE TABLE t3 (id INT);

TRUNCATE TABLE t1;
TRUNCATE TABLE t2;
TRUNCATE TABLE t3;

-- Or without TABLE keyword
TRUNCATE t1;
TRUNCATE t2;
TRUNCATE t3;

-- TRUNCATE with database prefixes
TRUNCATE TABLE db1.table1;
TRUNCATE TABLE db2.table2;
TRUNCATE TABLE db3.table3;

-- Clean up test tables
DROP TABLE IF EXISTS new_table;
DROP TABLE IF EXISTS renamed_table1, renamed_table2, renamed_table3;
DROP TABLE IF EXISTS child_trunc, parent_trunc;
DROP TABLE IF EXISTS table_with_trigger_trunc;
DROP TRIGGER IF EXISTS before_insert_trunc;
