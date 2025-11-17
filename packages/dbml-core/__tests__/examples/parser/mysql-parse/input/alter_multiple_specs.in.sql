-- Test ALTER TABLE with multiple specifications in one statement

-- Create base tables for testing
CREATE TABLE multi_alter_test (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  status VARCHAR(20),
  created_at TIMESTAMP
);

-- Add multiple columns at once
ALTER TABLE multi_alter_test
ADD COLUMN phone VARCHAR(20),
ADD COLUMN address TEXT,
ADD COLUMN age INT;

-- Drop multiple columns at once
ALTER TABLE multi_alter_test
DROP COLUMN phone,
DROP COLUMN address,
DROP COLUMN age;

-- Mix of ADD and DROP columns
ALTER TABLE multi_alter_test
ADD COLUMN phone VARCHAR(20),
ADD COLUMN city VARCHAR(100),
DROP COLUMN status;

-- Add column and index
ALTER TABLE multi_alter_test
ADD COLUMN department VARCHAR(50),
ADD INDEX idx_department (department);

-- Add multiple indexes
ALTER TABLE multi_alter_test
ADD INDEX idx_name (name),
ADD INDEX idx_email (email),
ADD INDEX idx_created (created_at);

-- Drop multiple indexes
ALTER TABLE multi_alter_test
DROP INDEX idx_name,
DROP INDEX idx_email,
DROP INDEX idx_created;

-- Add and drop indexes together
ALTER TABLE multi_alter_test
DROP INDEX idx_department,
ADD INDEX idx_name (name),
ADD INDEX idx_city (city);

-- Modify multiple columns
ALTER TABLE multi_alter_test
MODIFY COLUMN name VARCHAR(200),
MODIFY COLUMN email VARCHAR(200),
MODIFY COLUMN phone VARCHAR(25);

-- Change multiple columns
ALTER TABLE multi_alter_test
CHANGE COLUMN name full_name VARCHAR(200),
CHANGE COLUMN phone phone_number VARCHAR(25);

-- Mix of ADD, DROP, MODIFY
ALTER TABLE multi_alter_test
ADD COLUMN country VARCHAR(100),
DROP COLUMN department,
MODIFY COLUMN city VARCHAR(150);

-- Mix of ADD COLUMN, ADD INDEX, MODIFY COLUMN
ALTER TABLE multi_alter_test
ADD COLUMN zip_code VARCHAR(10),
ADD INDEX idx_zip (zip_code),
MODIFY COLUMN country VARCHAR(150);

-- Add column with constraints and index
ALTER TABLE multi_alter_test
ADD COLUMN score INT DEFAULT 0,
ADD COLUMN rating DECIMAL(3,2),
ADD INDEX idx_score (score),
ADD INDEX idx_rating (rating);

-- Add foreign key and index
CREATE TABLE departments (
  id INT PRIMARY KEY,
  name VARCHAR(100)
);

ALTER TABLE multi_alter_test
ADD COLUMN dept_id INT,
ADD INDEX idx_dept (dept_id),
ADD FOREIGN KEY fk_dept (dept_id) REFERENCES departments(id);

-- Drop foreign key and index
ALTER TABLE multi_alter_test
DROP FOREIGN KEY fk_dept,
DROP INDEX idx_dept,
DROP COLUMN dept_id;

-- Add constraints together
ALTER TABLE multi_alter_test
ADD CONSTRAINT chk_score CHECK (score >= 0),
ADD CONSTRAINT chk_rating CHECK (rating BETWEEN 0 AND 5),
ADD UNIQUE KEY uk_email (email);

-- Drop constraints together
ALTER TABLE multi_alter_test
DROP CHECK chk_score,
DROP CHECK chk_rating,
DROP INDEX uk_email;

-- Rename multiple indexes
ALTER TABLE multi_alter_test
RENAME INDEX idx_zip TO idx_zipcode,
RENAME INDEX idx_score TO idx_user_score;

-- Change table options with column changes
ALTER TABLE multi_alter_test
ADD COLUMN description TEXT,
MODIFY COLUMN full_name VARCHAR(255),
ENGINE=InnoDB,
COMMENT='Updated table with multiple changes';

-- Complex multi-specification ALTER
ALTER TABLE multi_alter_test
ADD COLUMN active BOOLEAN DEFAULT TRUE,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
DROP COLUMN phone_number,
MODIFY COLUMN city VARCHAR(200),
ADD INDEX idx_active (active),
DROP INDEX idx_city,
ADD UNIQUE KEY uk_email_new (email);

-- Add multiple columns with various constraints
ALTER TABLE multi_alter_test
ADD COLUMN first_name VARCHAR(100) NOT NULL,
ADD COLUMN last_name VARCHAR(100) NOT NULL,
ADD COLUMN middle_name VARCHAR(100),
ADD COLUMN birthdate DATE,
ADD COLUMN salary DECIMAL(10,2) CHECK (salary > 0);

-- Drop and recreate indexes with different definitions
ALTER TABLE multi_alter_test
DROP INDEX idx_user_score,
DROP INDEX idx_rating,
ADD INDEX idx_scores (score, rating),
ADD INDEX idx_created_desc (created_at DESC);

-- Change column definitions and add related indexes
ALTER TABLE multi_alter_test
MODIFY COLUMN first_name VARCHAR(150) NOT NULL,
MODIFY COLUMN last_name VARCHAR(150) NOT NULL,
ADD INDEX idx_full_name (first_name, last_name);

-- Add generated column with index
ALTER TABLE multi_alter_test
ADD COLUMN age_years INT AS (YEAR(CURDATE()) - YEAR(birthdate)) STORED,
ADD INDEX idx_age (age_years);

-- Multiple foreign keys
CREATE TABLE cities (id INT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE countries (id INT PRIMARY KEY, name VARCHAR(100));

ALTER TABLE multi_alter_test
ADD COLUMN city_id INT,
ADD COLUMN country_id INT,
ADD FOREIGN KEY fk_city (city_id) REFERENCES cities(id),
ADD FOREIGN KEY fk_country (country_id) REFERENCES countries(id);

-- Drop multiple foreign keys
ALTER TABLE multi_alter_test
DROP FOREIGN KEY fk_city,
DROP FOREIGN KEY fk_country;

-- Add column, drop column, rename column together
ALTER TABLE multi_alter_test
ADD COLUMN temp_col VARCHAR(50),
DROP COLUMN middle_name,
CHANGE COLUMN description notes TEXT;

-- Multiple RENAME COLUMN (MySQL 8.0+)
ALTER TABLE multi_alter_test
RENAME COLUMN first_name TO fname,
RENAME COLUMN last_name TO lname,
RENAME COLUMN temp_col TO temporary_column;

-- Change table character set and add columns
ALTER TABLE multi_alter_test
CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
ADD COLUMN unicode_name VARCHAR(100) CHARACTER SET utf8mb4;

-- Drop and add primary key with other changes
CREATE TABLE pk_test (
  id INT,
  code VARCHAR(20),
  name VARCHAR(100)
);

ALTER TABLE pk_test
ADD PRIMARY KEY (id),
ADD INDEX idx_code (code);

-- Recreate primary key
ALTER TABLE pk_test
DROP PRIMARY KEY,
ADD PRIMARY KEY (id, code);

-- Multiple column visibility changes (MySQL 8.0+)
ALTER TABLE multi_alter_test
ALTER COLUMN temporary_column SET INVISIBLE,
ALTER COLUMN notes SET INVISIBLE;

ALTER TABLE multi_alter_test
ALTER COLUMN temporary_column SET VISIBLE,
ALTER COLUMN notes SET VISIBLE;

-- Add columns with different default value types
ALTER TABLE multi_alter_test
ADD COLUMN created_date DATE DEFAULT (CURDATE()),
ADD COLUMN uuid VARCHAR(36) DEFAULT (UUID()),
ADD COLUMN sequence_num INT DEFAULT 0;

-- Modify columns to add/remove constraints
ALTER TABLE multi_alter_test
MODIFY COLUMN fname VARCHAR(150) NOT NULL,
MODIFY COLUMN lname VARCHAR(150) NOT NULL,
MODIFY COLUMN salary DECIMAL(12,2);

-- Complex combination: ADD, DROP, MODIFY, ADD INDEX, DROP INDEX, ADD FK
ALTER TABLE multi_alter_test
ADD COLUMN manager_id INT,
DROP COLUMN temporary_column,
MODIFY COLUMN salary DECIMAL(15,2),
ADD INDEX idx_manager (manager_id),
DROP INDEX idx_zipcode,
ADD FOREIGN KEY fk_manager (manager_id) REFERENCES multi_alter_test(id);

-- Add multiple FULLTEXT indexes
ALTER TABLE multi_alter_test
ADD FULLTEXT INDEX ft_name (fname, lname),
ADD FULLTEXT INDEX ft_notes (notes);

-- Change table options together
ALTER TABLE multi_alter_test
ENGINE=InnoDB,
ROW_FORMAT=DYNAMIC,
COMPRESSION='ZLIB',
COMMENT='Table with multiple option changes';

-- Add CHECK constraints with column additions
ALTER TABLE multi_alter_test
ADD COLUMN min_val INT,
ADD COLUMN max_val INT,
ADD CONSTRAINT chk_min CHECK (min_val >= 0),
ADD CONSTRAINT chk_max CHECK (max_val <= 100),
ADD CONSTRAINT chk_range CHECK (min_val < max_val);

-- Edge case: Many specifications at once (stress test)
ALTER TABLE multi_alter_test
ADD COLUMN col1 INT,
ADD COLUMN col2 VARCHAR(50),
ADD COLUMN col3 DECIMAL(10,2),
DROP COLUMN city_id,
DROP COLUMN country_id,
MODIFY COLUMN email VARCHAR(255),
ADD INDEX idx_col1 (col1),
ADD INDEX idx_col2 (col2),
DROP INDEX idx_active,
ADD CONSTRAINT chk_col3 CHECK (col3 > 0);

-- Reorder columns with AFTER clause and other changes
ALTER TABLE multi_alter_test
ADD COLUMN priority INT AFTER id,
ADD COLUMN category VARCHAR(50) FIRST,
MODIFY COLUMN age_years INT AFTER birthdate;

-- Change auto_increment start value with other changes
CREATE TABLE auto_inc_test (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data VARCHAR(100)
);

ALTER TABLE auto_inc_test
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
AUTO_INCREMENT=1000;

-- Drop and recreate multiple unique keys
ALTER TABLE multi_alter_test
DROP INDEX uk_email_new,
ADD UNIQUE KEY uk_email_updated (email),
ADD UNIQUE KEY uk_fname_lname (fname, lname);

-- Add partitioning with other changes (if supported)
CREATE TABLE partition_test (
  id INT,
  created_year INT,
  data VARCHAR(100)
);

ALTER TABLE partition_test
ADD PRIMARY KEY (id, created_year),
ADD INDEX idx_data (data);

-- Edge case: ALTER with ALGORITHM and LOCK clauses
ALTER TABLE multi_alter_test
ADD COLUMN instant_col INT,
MODIFY COLUMN notes TEXT,
ALGORITHM=INPLACE,
LOCK=NONE;

-- Edge case: Multiple visibility changes with other operations
ALTER TABLE multi_alter_test
ADD COLUMN hidden_col INT INVISIBLE,
ALTER COLUMN instant_col SET INVISIBLE,
MODIFY COLUMN score INT DEFAULT 100;
