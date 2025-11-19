-- Test ALTER TABLE RENAME, CHANGE, and RENAME COLUMN

-- Create base table
CREATE TABLE alter_rename_test (
  id INT PRIMARY KEY,
  old_name VARCHAR(100),
  old_email VARCHAR(100),
  status VARCHAR(20),
  value INT
);

-- RENAME COLUMN (MySQL 8.0+)
ALTER TABLE alter_rename_test RENAME COLUMN old_name TO new_name;

-- Multiple RENAME COLUMN in one statement
ALTER TABLE alter_rename_test
  RENAME COLUMN old_email TO new_email,
  RENAME COLUMN status TO current_status;

-- CHANGE COLUMN (rename and modify type)
ALTER TABLE alter_rename_test
  CHANGE COLUMN value amount DECIMAL(10,2);

-- CHANGE COLUMN (just rename, keep type)
ALTER TABLE alter_rename_test
  CHANGE COLUMN new_name full_name VARCHAR(100);

-- CHANGE COLUMN (rename and change type)
ALTER TABLE alter_rename_test
  CHANGE COLUMN current_status user_status VARCHAR(50);

-- CHANGE COLUMN with constraints
ALTER TABLE alter_rename_test
  CHANGE COLUMN amount total_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Multiple CHANGE COLUMN statements
ALTER TABLE alter_rename_test
  CHANGE COLUMN full_name display_name VARCHAR(200),
  CHANGE COLUMN new_email email_address VARCHAR(255);

-- CHANGE COLUMN with positioning (FIRST/AFTER)
ALTER TABLE alter_rename_test
  CHANGE COLUMN display_name name VARCHAR(200) FIRST;

ALTER TABLE alter_rename_test
  CHANGE COLUMN email_address email VARCHAR(255) AFTER id;

-- RENAME TABLE (rename the table itself)
ALTER TABLE alter_rename_test RENAME TO users_table;

-- RENAME TABLE using RENAME keyword only
ALTER TABLE users_table RENAME new_users_table;

-- RENAME TABLE with TO keyword
ALTER TABLE new_users_table RENAME TO final_users_table;

-- Edge case: RENAME COLUMN with backticks
CREATE TABLE backtick_test (
  `old-name` VARCHAR(100),
  `old-email` VARCHAR(100)
);

ALTER TABLE backtick_test RENAME COLUMN `old-name` TO `new-name`;
ALTER TABLE backtick_test RENAME COLUMN `old-email` TO `new-email`;

-- Edge case: CHANGE with backticks
ALTER TABLE backtick_test CHANGE COLUMN `new-name` `display-name` VARCHAR(200);

-- Edge case: RENAME COLUMN with reserved words
CREATE TABLE reserved_rename_test (
  `select` VARCHAR(100),
  `where` VARCHAR(100),
  `from` VARCHAR(100)
);

ALTER TABLE reserved_rename_test RENAME COLUMN `select` TO `query`;
ALTER TABLE reserved_rename_test RENAME COLUMN `where` TO `condition`;
ALTER TABLE reserved_rename_test RENAME COLUMN `from` TO `source`;

-- Edge case: CHANGE with reserved words
ALTER TABLE reserved_rename_test CHANGE COLUMN `query` `command` VARCHAR(200);
ALTER TABLE reserved_rename_test CHANGE COLUMN `condition` `filter` TEXT;

-- RENAME INDEX (not column, but related)
CREATE TABLE index_rename_test (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  INDEX old_idx_name (name),
  INDEX old_idx_email (email)
);

ALTER TABLE index_rename_test RENAME INDEX old_idx_name TO new_idx_name;
ALTER TABLE index_rename_test RENAME INDEX old_idx_email TO new_idx_email;

-- Multiple index renames
ALTER TABLE index_rename_test
  RENAME INDEX new_idx_name TO idx_name,
  RENAME INDEX new_idx_email TO idx_email;

-- Edge case: CHANGE to same column name but different type
CREATE TABLE type_change_test (
  id INT,
  data VARCHAR(100)
);

ALTER TABLE type_change_test CHANGE COLUMN data data TEXT;
ALTER TABLE type_change_test CHANGE COLUMN id id BIGINT;

-- Edge case: CHANGE with all column attributes
CREATE TABLE full_attributes_test (
  id INT,
  value INT
);

ALTER TABLE full_attributes_test
  CHANGE COLUMN value amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Amount field';

-- CHANGE with AUTO_INCREMENT
ALTER TABLE full_attributes_test
  CHANGE COLUMN id id BIGINT AUTO_INCREMENT PRIMARY KEY;

-- CHANGE with generated column
CREATE TABLE generated_rename_test (
  id INT PRIMARY KEY,
  price DECIMAL(10,2),
  tax DECIMAL(10,2) AS (price * 0.1) STORED
);

ALTER TABLE generated_rename_test
  CHANGE COLUMN tax sales_tax DECIMAL(10,2) AS (price * 0.1) STORED;

-- CHANGE with FIRST/AFTER positioning
CREATE TABLE position_test (
  col1 INT,
  col2 INT,
  col3 INT,
  col4 INT
);

ALTER TABLE position_test CHANGE COLUMN col4 new_col4 INT FIRST;
ALTER TABLE position_test CHANGE COLUMN col1 new_col1 INT AFTER col3;

-- RENAME COLUMN combined with other ALTER operations
ALTER TABLE position_test
  RENAME COLUMN col2 TO new_col2,
  ADD COLUMN col5 INT,
  DROP COLUMN col3;

-- CHANGE COLUMN combined with other operations
ALTER TABLE position_test
  CHANGE COLUMN new_col2 renamed_col2 VARCHAR(100),
  ADD INDEX idx_col5 (col5),
  MODIFY COLUMN new_col4 BIGINT;

-- Edge case: Rename to very long name
CREATE TABLE long_name_test (
  short_name INT
);

ALTER TABLE long_name_test
  RENAME COLUMN short_name TO very_long_column_name_that_is_almost_at_maximum_length;

-- Edge case: Chain of renames
CREATE TABLE chain_test (
  col_a INT
);

ALTER TABLE chain_test RENAME COLUMN col_a TO col_b;
ALTER TABLE chain_test RENAME COLUMN col_b TO col_c;
ALTER TABLE chain_test RENAME COLUMN col_c TO col_final;

-- Edge case: Rename with foreign key
CREATE TABLE fk_parent (id INT PRIMARY KEY);
CREATE TABLE fk_child (
  id INT PRIMARY KEY,
  parent_id INT,
  FOREIGN KEY (parent_id) REFERENCES fk_parent(id)
);

ALTER TABLE fk_child RENAME COLUMN parent_id TO fk_parent_id;

-- CHANGE with foreign key (more complex)
ALTER TABLE fk_child
  CHANGE COLUMN fk_parent_id parent_ref_id INT;

-- Edge case: Rename indexed column
CREATE TABLE indexed_rename (
  id INT PRIMARY KEY,
  searchable VARCHAR(100),
  INDEX idx_search (searchable)
);

ALTER TABLE indexed_rename RENAME COLUMN searchable TO search_field;
-- Index should still work on renamed column

-- Edge case: Rename primary key column
CREATE TABLE pk_rename (
  old_id INT PRIMARY KEY
);

ALTER TABLE pk_rename CHANGE COLUMN old_id new_id INT PRIMARY KEY;

-- Edge case: Rename unique key column
CREATE TABLE uk_rename (
  id INT PRIMARY KEY,
  unique_field VARCHAR(100) UNIQUE
);

ALTER TABLE uk_rename RENAME COLUMN unique_field TO new_unique_field;

-- CHANGE with UNIQUE constraint
ALTER TABLE uk_rename
  CHANGE COLUMN new_unique_field email VARCHAR(255) UNIQUE;

-- Edge case: Rename column referenced by generated column
CREATE TABLE gen_col_rename (
  id INT PRIMARY KEY,
  base_value INT,
  computed INT AS (base_value * 2) STORED
);

ALTER TABLE gen_col_rename RENAME COLUMN base_value TO source_value;
-- Generated column should update reference

-- Edge case: Rename with CHECK constraint
CREATE TABLE check_rename (
  id INT PRIMARY KEY,
  age INT CHECK (age >= 0)
);

ALTER TABLE check_rename RENAME COLUMN age TO user_age;

-- CHANGE with CHECK constraint
ALTER TABLE check_rename
  CHANGE COLUMN user_age person_age INT CHECK (person_age >= 0 AND person_age <= 150);

-- Edge case: Multiple renames creating a "cycle"
CREATE TABLE cycle_test (
  col_a INT,
  col_b INT,
  col_c INT
);

-- Need temporary column for swap
ALTER TABLE cycle_test
  ADD COLUMN temp_col INT,
  CHANGE COLUMN col_a temp_a INT,
  CHANGE COLUMN col_b col_a INT,
  CHANGE COLUMN col_c col_b INT,
  CHANGE COLUMN temp_a col_c INT;

-- RENAME table with backticks
ALTER TABLE `backtick_test` RENAME TO `new-backtick-test`;

-- RENAME table with database prefix
ALTER TABLE mydb.old_table RENAME TO mydb.new_table;

-- RENAME table to different database
ALTER TABLE db1.table1 RENAME TO db2.table1;

-- Edge case: RENAME COLUMN on TIMESTAMP columns with ON UPDATE
CREATE TABLE timestamp_rename (
  id INT PRIMARY KEY,
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE timestamp_rename RENAME COLUMN created TO created_at;
ALTER TABLE timestamp_rename RENAME COLUMN modified TO updated_at;

-- CHANGE TIMESTAMP with attributes
ALTER TABLE timestamp_rename
  CHANGE COLUMN created_at creation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Edge case: Rename ENUM/SET columns
CREATE TABLE enum_rename (
  id INT PRIMARY KEY,
  status ENUM('active', 'inactive', 'pending'),
  permissions SET('read', 'write', 'delete')
);

ALTER TABLE enum_rename RENAME COLUMN status TO current_status;
ALTER TABLE enum_rename RENAME COLUMN permissions TO user_permissions;

-- CHANGE ENUM with different values
ALTER TABLE enum_rename
  CHANGE COLUMN current_status state ENUM('new', 'active', 'archived');

-- Edge case: Rename JSON column
CREATE TABLE json_rename (
  id INT PRIMARY KEY,
  data JSON
);

ALTER TABLE json_rename RENAME COLUMN data TO metadata;

-- CHANGE JSON column
ALTER TABLE json_rename
  CHANGE COLUMN metadata json_data JSON;

-- Edge case: Rename with INVISIBLE column (MySQL 8.0+)
CREATE TABLE invisible_rename (
  id INT PRIMARY KEY,
  visible_col INT,
  hidden_col INT INVISIBLE
);

ALTER TABLE invisible_rename RENAME COLUMN hidden_col TO secret_col;

-- CHANGE with INVISIBLE
ALTER TABLE invisible_rename
  CHANGE COLUMN secret_col internal_col INT INVISIBLE;

-- Edge case: Rename multiple times in sequence
CREATE TABLE multi_rename (
  original_name INT
);

ALTER TABLE multi_rename RENAME COLUMN original_name TO name_v1;
ALTER TABLE multi_rename RENAME COLUMN name_v1 TO name_v2;
ALTER TABLE multi_rename RENAME COLUMN name_v2 TO name_v3;
ALTER TABLE multi_rename RENAME COLUMN name_v3 TO final_name;
