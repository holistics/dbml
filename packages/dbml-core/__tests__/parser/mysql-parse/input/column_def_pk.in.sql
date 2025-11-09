-- MySQL Inline Column PRIMARY KEY Test Cases

-- ============================================
-- BASIC INLINE PRIMARY KEY
-- ============================================

-- Simple INTEGER PRIMARY KEY
CREATE TABLE test_pk_int (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);

-- BIGINT PRIMARY KEY
CREATE TABLE test_pk_bigint (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(50)
);

-- VARCHAR PRIMARY KEY
CREATE TABLE test_pk_varchar (
    code VARCHAR(20) PRIMARY KEY,
    description TEXT
);

-- ============================================
-- PRIMARY KEY WITH AUTO_INCREMENT
-- ============================================

-- AUTO_INCREMENT PRIMARY KEY
CREATE TABLE test_pk_auto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data VARCHAR(100)
);

-- PRIMARY KEY AUTO_INCREMENT (different order)
CREATE TABLE test_pk_auto_alt (
    id INT PRIMARY KEY AUTO_INCREMENT,
    value VARCHAR(100)
);

-- ============================================
-- PRIMARY KEY WITH NOT NULL
-- ============================================

-- PRIMARY KEY with explicit NOT NULL
CREATE TABLE test_pk_not_null (
    id INT NOT NULL PRIMARY KEY,
    name VARCHAR(100)
);

-- PRIMARY KEY NOT NULL AUTO_INCREMENT
CREATE TABLE test_pk_not_null_auto (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100)
);

-- ============================================
-- PRIMARY KEY WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_pk_datatypes (
    -- Integer types
    tinyint_pk TINYINT PRIMARY KEY
);

CREATE TABLE test_pk_smallint (
    smallint_pk SMALLINT PRIMARY KEY,
    data VARCHAR(50)
);

CREATE TABLE test_pk_mediumint (
    mediumint_pk MEDIUMINT PRIMARY KEY,
    info TEXT
);

CREATE TABLE test_pk_char (
    char_pk CHAR(10) PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE test_pk_decimal (
    decimal_pk DECIMAL(10,0) PRIMARY KEY,
    amount DECIMAL(12,2)
);

-- ============================================
-- PRIMARY KEY WITH UNSIGNED
-- ============================================

-- UNSIGNED INT PRIMARY KEY
CREATE TABLE test_pk_unsigned (
    id INT UNSIGNED PRIMARY KEY,
    status VARCHAR(20)
);

-- UNSIGNED BIGINT AUTO_INCREMENT PRIMARY KEY
CREATE TABLE test_pk_unsigned_auto (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PRIMARY KEY WITH DEFAULT
-- ============================================

-- PRIMARY KEY with DEFAULT (unusual but valid)
CREATE TABLE test_pk_default (
    id INT PRIMARY KEY DEFAULT 1,
    name VARCHAR(100)
);

-- ============================================
-- PRIMARY KEY WITH COMMENTS
-- ============================================

-- PRIMARY KEY with column comment
CREATE TABLE test_pk_comment (
    id INT PRIMARY KEY COMMENT 'Primary key identifier',
    description VARCHAR(200)
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Multiple columns, one PRIMARY KEY
CREATE TABLE test_pk_multi_col (
    id INT PRIMARY KEY,
    col1 VARCHAR(50),
    col2 INT,
    col3 DATE
);

-- PRIMARY KEY with backtick quoted name
CREATE TABLE test_pk_quoted (
    `order-id` INT PRIMARY KEY,
    order_date DATE
);

-- Schema-qualified table with PRIMARY KEY
CREATE TABLE hr.test_pk_schema (
    emp_id INT PRIMARY KEY,
    emp_name VARCHAR(100)
);
