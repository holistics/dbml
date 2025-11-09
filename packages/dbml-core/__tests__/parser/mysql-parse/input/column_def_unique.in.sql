-- MySQL Inline Column UNIQUE Test Cases

-- ============================================
-- BASIC INLINE UNIQUE
-- ============================================

-- Simple UNIQUE constraint
CREATE TABLE test_unique_basic (
    id INT PRIMARY KEY,
    email VARCHAR(100) UNIQUE,
    username VARCHAR(50) UNIQUE
);

-- UNIQUE with NOT NULL
CREATE TABLE test_unique_not_null (
    id INT PRIMARY KEY,
    ssn VARCHAR(11) UNIQUE NOT NULL,
    passport VARCHAR(20) UNIQUE NOT NULL
);

-- ============================================
-- UNIQUE WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_unique_int (
    id INT PRIMARY KEY,
    employee_number INT UNIQUE,
    badge_id INT UNIQUE
);

CREATE TABLE test_unique_varchar (
    id INT PRIMARY KEY,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    license_plate VARCHAR(15) UNIQUE
);

CREATE TABLE test_unique_char (
    id INT PRIMARY KEY,
    code CHAR(10) UNIQUE,
    serial CHAR(20) UNIQUE
);

CREATE TABLE test_unique_bigint (
    id INT PRIMARY KEY,
    card_number BIGINT UNIQUE,
    account_number BIGINT UNIQUE
);

-- ============================================
-- UNIQUE WITH DEFAULT VALUES
-- ============================================

CREATE TABLE test_unique_default (
    id INT PRIMARY KEY,
    tracking_code VARCHAR(50) UNIQUE DEFAULT (UUID()),
    ref_number VARCHAR(50) UNIQUE
);

-- ============================================
-- UNIQUE WITH AUTO_INCREMENT
-- ============================================

CREATE TABLE test_unique_auto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number INT UNIQUE,
    invoice_number VARCHAR(50) UNIQUE
);

-- ============================================
-- UNIQUE KEY vs UNIQUE
-- ============================================

-- Using UNIQUE KEY syntax
CREATE TABLE test_unique_key (
    id INT PRIMARY KEY,
    email VARCHAR(100) UNIQUE KEY,
    username VARCHAR(50) UNIQUE KEY
);

-- ============================================
-- NAMED UNIQUE CONSTRAINTS (inline)
-- ============================================

CREATE TABLE test_unique_named (
    id INT PRIMARY KEY,
    email VARCHAR(100),
    username VARCHAR(50),
    ssn VARCHAR(11),
    CONSTRAINT uq_email UNIQUE (email),
    CONSTRAINT uq_username UNIQUE (username),
    CONSTRAINT uq_ssn UNIQUE (ssn)
);

-- ============================================
-- COMPOSITE UNIQUE CONSTRAINTS
-- ============================================

-- Composite unique constraint
CREATE TABLE test_unique_composite (
    id INT PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    birth_date DATE,
    CONSTRAINT uq_person UNIQUE (first_name, last_name, birth_date)
);

-- Multiple composite unique constraints
CREATE TABLE test_unique_multi_composite (
    id INT PRIMARY KEY,
    country VARCHAR(50),
    state VARCHAR(50),
    city VARCHAR(50),
    zip_code VARCHAR(10),
    CONSTRAINT uq_location1 UNIQUE (country, state, city),
    CONSTRAINT uq_location2 UNIQUE (zip_code, city)
);

-- ============================================
-- UNIQUE WITH UNSIGNED
-- ============================================

CREATE TABLE test_unique_unsigned (
    id INT UNSIGNED PRIMARY KEY,
    customer_number INT UNSIGNED UNIQUE,
    order_sequence BIGINT UNSIGNED UNIQUE
);

-- ============================================
-- UNIQUE WITH COMMENTS
-- ============================================

CREATE TABLE test_unique_comment (
    id INT PRIMARY KEY,
    email VARCHAR(100) UNIQUE COMMENT 'User email must be unique',
    username VARCHAR(50) UNIQUE COMMENT 'Username must be unique across system'
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Multiple UNIQUE constraints on same table
CREATE TABLE test_unique_multiple (
    id INT PRIMARY KEY,
    col1 VARCHAR(50) UNIQUE,
    col2 VARCHAR(50) UNIQUE,
    col3 VARCHAR(50) UNIQUE,
    col4 INT UNIQUE,
    col5 INT UNIQUE
);

-- UNIQUE with quoted identifiers
CREATE TABLE `test-unique-quoted` (
    id INT PRIMARY KEY,
    `email-address` VARCHAR(100) UNIQUE,
    `user-name` VARCHAR(50) UNIQUE
);

-- Schema-qualified table with UNIQUE
CREATE TABLE hr.test_unique_schema (
    emp_id INT PRIMARY KEY,
    emp_email VARCHAR(100) UNIQUE,
    emp_badge INT UNIQUE
);

-- UNIQUE with NULL allowed
CREATE TABLE test_unique_nullable (
    id INT PRIMARY KEY,
    optional_email VARCHAR(100) UNIQUE,
    optional_phone VARCHAR(20) UNIQUE
);

-- Combination of inline and table-level UNIQUE
CREATE TABLE test_unique_mixed (
    id INT PRIMARY KEY,
    email VARCHAR(100) UNIQUE,
    username VARCHAR(50),
    ssn VARCHAR(11),
    CONSTRAINT uq_username_ssn UNIQUE (username, ssn)
);
