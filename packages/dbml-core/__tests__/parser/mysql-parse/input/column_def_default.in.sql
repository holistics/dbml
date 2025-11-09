-- MySQL Inline Column Default Test Cases
-- Test setup: Create tables with inline DEFAULT on different columns

CREATE TABLE customers (
    cust_id INT DEFAULT 0,
    cust_name VARCHAR(100) DEFAULT 'Unknown',
    email VARCHAR(100) DEFAULT 'noemail@example.com',
    phone VARCHAR(20) DEFAULT 'N/A',
    address VARCHAR(200) DEFAULT 'Unknown Address',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    reg_date DATE DEFAULT (CURRENT_DATE),
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory (
    item_id INT DEFAULT 1,
    item_name VARCHAR(200) DEFAULT 'Item',
    price DECIMAL(10,2) DEFAULT 0.00,
    category VARCHAR(50) DEFAULT 'Misc',
    sku VARCHAR(50) DEFAULT 'SKU000',
    weight DECIMAL(8,2) DEFAULT 0.0,
    stock_level INT DEFAULT 0,
    reorder_level INT DEFAULT 10
);

CREATE TABLE shipments (
    ship_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT DEFAULT 1,
    ship_date DATE DEFAULT (CURRENT_DATE),
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    tracking_number VARCHAR(50) DEFAULT (UUID()),
    carrier VARCHAR(100) DEFAULT 'UPS',
    priority INT DEFAULT 1,
    notes TEXT DEFAULT 'No notes'
);

CREATE TABLE departments (
    dept_id INT DEFAULT 100,
    dept_name VARCHAR(100) DEFAULT 'General',
    manager_id INT DEFAULT 0,
    budget DECIMAL(12,2) DEFAULT 10000.00,
    location VARCHAR(50) DEFAULT 'HQ',
    established_date DATE DEFAULT (CURRENT_DATE)
);

CREATE TABLE suppliers (
    supp_id INT DEFAULT 500,
    supp_name VARCHAR(100) DEFAULT 'Supplier',
    contact VARCHAR(100) DEFAULT 'Contact',
    ssn VARCHAR(11) DEFAULT '000-00-0000',
    badge_number VARCHAR(10) DEFAULT 'BADGE000',
    credit_limit DECIMAL(10,2) DEFAULT 5000.00
);

-- ============================================
-- BASIC INLINE DEFAULTS
-- ============================================

-- Simple DEFAULT (numeric literal)
CREATE TABLE test_basic_num (
    id INT DEFAULT 0,
    value INT DEFAULT 100
);

-- DEFAULT on VARCHAR (string literal)
CREATE TABLE test_basic_varchar (
    name VARCHAR(100) DEFAULT 'Unknown',
    code VARCHAR(10) DEFAULT 'CODE'
);

-- DEFAULT on DATE
CREATE TABLE test_basic_date (
    event_date DATE DEFAULT (CURRENT_DATE),
    end_date DATETIME DEFAULT (CURRENT_TIMESTAMP)
);

-- ============================================
-- INLINE DEFAULT WITH EXPRESSIONS
-- ============================================

-- DEFAULT with CURRENT_DATE
CREATE TABLE test_expr_current_date (
    created_at DATE DEFAULT (CURRENT_DATE),
    updated_at DATE DEFAULT (CURRENT_DATE)
);

-- DEFAULT with CURRENT_USER
CREATE TABLE test_expr_user (
    created_by VARCHAR(30) DEFAULT (CURRENT_USER),
    modified_by VARCHAR(30) DEFAULT (USER())
);

-- DEFAULT with UUID()
CREATE TABLE test_expr_uuid (
    unique_id VARCHAR(36) DEFAULT (UUID()),
    session_id VARCHAR(36) DEFAULT (UUID())
);

-- DEFAULT with arithmetic expression
CREATE TABLE test_expr_arith (
    base_value INT DEFAULT 1000,
    calc_value INT DEFAULT (1000 + 500)
);

-- ============================================
-- INLINE DEFAULT COMBINED WITH NOT NULL
-- ============================================

-- DEFAULT with NOT NULL
CREATE TABLE test_default_not_null (
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    priority INT DEFAULT 1 NOT NULL
);

-- ============================================
-- INLINE DEFAULT ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes_inline (
    col_int INT DEFAULT 0,
    col_varchar VARCHAR(100) DEFAULT 'Text',
    col_text TEXT,
    col_date DATE DEFAULT (CURRENT_DATE),
    col_datetime DATETIME DEFAULT (CURRENT_TIMESTAMP),
    col_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    col_decimal DECIMAL(10,2) DEFAULT 0.00,
    col_float FLOAT DEFAULT 1.23,
    col_double DOUBLE DEFAULT 3.14159,
    col_boolean BOOLEAN DEFAULT TRUE
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- DEFAULT with complex expression
CREATE TABLE test_complex_expr (
    full_name VARCHAR(200) DEFAULT (CONCAT(USER(), '_USER')),
    calc_field INT DEFAULT (100 * 2)
);

-- Very long default string
CREATE TABLE test_long_default (
    description TEXT DEFAULT 'This is a very long default value for testing purposes, exceeding typical lengths to check parser limits and storage implications in MySQL',
    comments TEXT DEFAULT 'Another long default string to test maximum lengths and handling in table creation statements'
);

-- DEFAULT with NULL
CREATE TABLE test_null_default (
    optional_field VARCHAR(100) DEFAULT NULL,
    nullable_int INT DEFAULT NULL
);

-- DEFAULT with CURRENT_TIMESTAMP ON UPDATE
CREATE TABLE test_on_update (
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
