-- MySQL In-Table UNIQUE Constraint Test Cases

-- ============================================
-- BASIC IN-TABLE UNIQUE
-- ============================================

-- Simple UNIQUE constraint
CREATE TABLE test_unique_table (
    id INT PRIMARY KEY,
    email VARCHAR(100),
    UNIQUE (email)
);

-- Named UNIQUE constraint
CREATE TABLE test_unique_named (
    id INT PRIMARY KEY,
    username VARCHAR(50),
    CONSTRAINT uq_username UNIQUE (username)
);

-- Multiple UNIQUE constraints
CREATE TABLE test_unique_multiple (
    id INT PRIMARY KEY,
    email VARCHAR(100),
    username VARCHAR(50),
    ssn VARCHAR(11),
    UNIQUE (email),
    UNIQUE (username),
    UNIQUE (ssn)
);

-- Multiple named UNIQUE constraints
CREATE TABLE test_unique_multiple_named (
    id INT PRIMARY KEY,
    email VARCHAR(100),
    phone VARCHAR(20),
    license VARCHAR(20),
    CONSTRAINT uq_email UNIQUE (email),
    CONSTRAINT uq_phone UNIQUE (phone),
    CONSTRAINT uq_license UNIQUE (license)
);

-- ============================================
-- COMPOSITE UNIQUE CONSTRAINTS
-- ============================================

-- Two-column composite UNIQUE
CREATE TABLE test_unique_composite_2 (
    id INT PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100),
    UNIQUE (first_name, last_name)
);

-- Named composite UNIQUE
CREATE TABLE test_unique_composite_named (
    id INT PRIMARY KEY,
    country VARCHAR(50),
    state VARCHAR(50),
    city VARCHAR(50),
    CONSTRAINT uq_location UNIQUE (country, state, city)
);

-- Three-column composite UNIQUE
CREATE TABLE test_unique_composite_3 (
    id INT PRIMARY KEY,
    year INT,
    month INT,
    day INT,
    event VARCHAR(100),
    CONSTRAINT uq_date UNIQUE (year, month, day)
);

-- Multiple composite UNIQUE constraints
CREATE TABLE test_unique_multi_composite (
    id INT PRIMARY KEY,
    col1 VARCHAR(50),
    col2 VARCHAR(50),
    col3 VARCHAR(50),
    col4 VARCHAR(50),
    CONSTRAINT uq_comp1 UNIQUE (col1, col2),
    CONSTRAINT uq_comp2 UNIQUE (col3, col4)
);

-- ============================================
-- UNIQUE WITH OTHER CONSTRAINTS
-- ============================================

-- UNIQUE with FOREIGN KEY
CREATE TABLE users (
    user_id INT PRIMARY KEY,
    username VARCHAR(50)
);

CREATE TABLE user_emails (
    email_id INT PRIMARY KEY,
    user_id INT,
    email VARCHAR(100),
    UNIQUE (email),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- UNIQUE with NOT NULL
CREATE TABLE test_unique_not_null (
    id INT PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    serial VARCHAR(20) NOT NULL,
    CONSTRAINT uq_code UNIQUE (code),
    CONSTRAINT uq_serial UNIQUE (serial)
);

-- UNIQUE with DEFAULT
CREATE TABLE test_unique_default (
    id INT PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'active',
    tracking_code VARCHAR(50),
    UNIQUE (tracking_code)
);

-- UNIQUE with CHECK constraint
CREATE TABLE test_unique_check (
    id INT PRIMARY KEY,
    email VARCHAR(100),
    age INT,
    UNIQUE (email),
    CHECK (age >= 18)
);

-- ============================================
-- UNIQUE KEY vs UNIQUE CONSTRAINT
-- ============================================

-- Using UNIQUE KEY syntax
CREATE TABLE test_unique_key_syntax (
    id INT PRIMARY KEY,
    code VARCHAR(20),
    UNIQUE KEY (code)
);

-- Using UNIQUE INDEX syntax
CREATE TABLE test_unique_index_syntax (
    id INT PRIMARY KEY,
    ref_number VARCHAR(50),
    UNIQUE INDEX uq_ref (ref_number)
);

-- Mixed UNIQUE KEY and constraint names
CREATE TABLE test_unique_mixed_syntax (
    id INT PRIMARY KEY,
    col1 VARCHAR(50),
    col2 VARCHAR(50),
    UNIQUE KEY uq_col1 (col1),
    CONSTRAINT uq_col2 UNIQUE (col2)
);

-- ============================================
-- UNIQUE WITH INDEX OPTIONS
-- ============================================

-- UNIQUE with USING BTREE
CREATE TABLE test_unique_btree (
    id INT PRIMARY KEY,
    code VARCHAR(20),
    UNIQUE (code) USING BTREE
);

-- UNIQUE with USING HASH (for MEMORY engine)
CREATE TABLE test_unique_hash (
    id INT PRIMARY KEY,
    ref_id INT,
    UNIQUE (ref_id) USING HASH
) ENGINE=MEMORY;

-- ============================================
-- UNIQUE ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_unique_datatypes (
    id INT PRIMARY KEY,
    int_col INT,
    bigint_col BIGINT,
    varchar_col VARCHAR(100),
    char_col CHAR(10),
    date_col DATE,
    decimal_col DECIMAL(10,2),
    UNIQUE (int_col),
    UNIQUE (bigint_col),
    UNIQUE (varchar_col),
    UNIQUE (char_col),
    UNIQUE (date_col),
    UNIQUE (decimal_col)
);

-- ============================================
-- EDGE CASES
-- ============================================

-- UNIQUE on AUTO_INCREMENT column (not PRIMARY KEY)
CREATE TABLE test_unique_auto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sequence_num INT AUTO_INCREMENT UNIQUE
);

-- UNIQUE with quoted identifiers
CREATE TABLE `test-unique-quoted` (
    id INT PRIMARY KEY,
    `email-address` VARCHAR(100),
    CONSTRAINT `uq-email` UNIQUE (`email-address`)
);

-- Schema-qualified table with UNIQUE
CREATE SCHEMA IF NOT EXISTS test_schema;
CREATE TABLE test_schema.test_unique_schema (
    id INT PRIMARY KEY,
    code VARCHAR(20),
    CONSTRAINT uq_code UNIQUE (code)
);

-- Combination of inline and table-level UNIQUE
CREATE TABLE test_unique_inline_table (
    id INT PRIMARY KEY,
    email VARCHAR(100) UNIQUE,
    username VARCHAR(50),
    phone VARCHAR(20),
    CONSTRAINT uq_username UNIQUE (username),
    UNIQUE (phone)
);

-- UNIQUE on nullable columns
CREATE TABLE test_unique_nullable (
    id INT PRIMARY KEY,
    optional_email VARCHAR(100),
    optional_code VARCHAR(20),
    UNIQUE (optional_email),
    UNIQUE (optional_code)
);

-- Multiple constraints including UNIQUE
CREATE TABLE test_unique_with_all (
    id INT PRIMARY KEY,
    user_id INT,
    email VARCHAR(100),
    username VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (email),
    UNIQUE (username),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Very long composite UNIQUE
CREATE TABLE test_unique_long_composite (
    id INT PRIMARY KEY,
    col1 VARCHAR(50),
    col2 VARCHAR(50),
    col3 VARCHAR(50),
    col4 VARCHAR(50),
    col5 VARCHAR(50),
    CONSTRAINT uq_long UNIQUE (col1, col2, col3, col4, col5)
);

-- UNIQUE with table options
CREATE TABLE test_unique_table_options (
    id INT PRIMARY KEY,
    code VARCHAR(20),
    UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
