-- MySQL AUTO_INCREMENT Test Cases

-- ============================================
-- BASIC AUTO_INCREMENT
-- ============================================

-- Simple AUTO_INCREMENT with PRIMARY KEY
CREATE TABLE test_auto_basic (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100)
);

-- AUTO_INCREMENT after PRIMARY KEY
CREATE TABLE test_auto_pk_first (
    id INT PRIMARY KEY AUTO_INCREMENT,
    data VARCHAR(100)
);

-- ============================================
-- AUTO_INCREMENT WITH DIFFERENT INTEGER TYPES
-- ============================================

-- TINYINT AUTO_INCREMENT
CREATE TABLE test_auto_tinyint (
    id TINYINT AUTO_INCREMENT PRIMARY KEY,
    value VARCHAR(50)
);

-- SMALLINT AUTO_INCREMENT
CREATE TABLE test_auto_smallint (
    id SMALLINT AUTO_INCREMENT PRIMARY KEY,
    description TEXT
);

-- MEDIUMINT AUTO_INCREMENT
CREATE TABLE test_auto_mediumint (
    id MEDIUMINT AUTO_INCREMENT PRIMARY KEY,
    info VARCHAR(200)
);

-- BIGINT AUTO_INCREMENT
CREATE TABLE test_auto_bigint (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    data TEXT
);

-- ============================================
-- AUTO_INCREMENT WITH UNSIGNED
-- ============================================

-- UNSIGNED INT AUTO_INCREMENT
CREATE TABLE test_auto_unsigned (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(20)
);

-- UNSIGNED BIGINT AUTO_INCREMENT
CREATE TABLE test_auto_bigint_unsigned (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUTO_INCREMENT WITH NOT NULL
-- ============================================

-- AUTO_INCREMENT with explicit NOT NULL
CREATE TABLE test_auto_not_null (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100)
);

-- ============================================
-- AUTO_INCREMENT WITH TABLE OPTIONS
-- ============================================

-- AUTO_INCREMENT with initial value
CREATE TABLE test_auto_initial (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100)
) AUTO_INCREMENT=1000;

-- AUTO_INCREMENT with ENGINE
CREATE TABLE test_auto_engine (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data VARCHAR(100)
) ENGINE=InnoDB AUTO_INCREMENT=100;

-- AUTO_INCREMENT with CHARSET
CREATE TABLE test_auto_charset (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;

-- ============================================
-- AUTO_INCREMENT WITH OTHER CONSTRAINTS
-- ============================================

-- AUTO_INCREMENT with UNIQUE
CREATE TABLE test_auto_unique (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE,
    name VARCHAR(100)
);

-- AUTO_INCREMENT with FOREIGN KEY in other column
CREATE TABLE customers (
    cust_id INT AUTO_INCREMENT PRIMARY KEY,
    cust_name VARCHAR(100)
);

CREATE TABLE orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    order_date DATE,
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);

-- ============================================
-- AUTO_INCREMENT WITH DEFAULT AND TIMESTAMP
-- ============================================

CREATE TABLE test_auto_with_defaults (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'active',
    priority INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- AUTO_INCREMENT WITH COMMENTS
-- ============================================

CREATE TABLE test_auto_comment (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Auto-incrementing primary key',
    description VARCHAR(200) COMMENT 'Description field'
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Multiple columns with AUTO_INCREMENT on first
CREATE TABLE test_auto_multi_col (
    id INT AUTO_INCREMENT PRIMARY KEY,
    col1 VARCHAR(50),
    col2 INT,
    col3 DATE,
    col4 DECIMAL(10,2)
);

-- AUTO_INCREMENT with quoted table name
CREATE TABLE `test-auto-quoted` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `item-name` VARCHAR(100)
);

-- Schema-qualified table with AUTO_INCREMENT
CREATE SCHEMA IF NOT EXISTS test_schema;
CREATE TABLE test_schema.test_auto_schema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data VARCHAR(100)
);

-- AUTO_INCREMENT with ZEROFILL
CREATE TABLE test_auto_zerofill (
    id INT UNSIGNED ZEROFILL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100)
);

-- AUTO_INCREMENT with very large initial value
CREATE TABLE test_auto_large_init (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    info TEXT
) AUTO_INCREMENT=9223372036854775000;

-- Temporary table with AUTO_INCREMENT
CREATE TEMPORARY TABLE temp_auto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    temp_data VARCHAR(100)
);

-- AUTO_INCREMENT with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS test_auto_if_not_exists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100)
);
