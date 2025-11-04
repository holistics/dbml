-- Oracle SQL CREATE INDEX Test Cases
-- Test setup: Create tables to support index creation with minimal required fields
CREATE TABLE customers (
    cust_id NUMBER(10),
    cust_name VARCHAR2(100),
    email VARCHAR2(100),
    phone VARCHAR2(20),
    status VARCHAR2(20),
    reg_date DATE,
    region VARCHAR2(50),
    credit_limit NUMBER(10,2)
);

CREATE TABLE inventory (
    item_id NUMBER(10),
    item_name VARCHAR2(200),
    price NUMBER(10,2),
    category VARCHAR2(50),
    sku VARCHAR2(50),
    stock_level NUMBER(10),
    warehouse_id NUMBER(10),
    supplier_id NUMBER(10)
);

CREATE TABLE shipments (
    ship_id NUMBER(10),
    customer_id NUMBER(10),
    ship_date DATE,
    total_amount NUMBER(12,2),
    tracking_number VARCHAR2(50),
    carrier VARCHAR2(100),
    priority NUMBER(2)
);

CREATE TABLE departments (
    dept_id NUMBER(10),
    dept_name VARCHAR2(100),
    manager_id NUMBER(10),
    location VARCHAR2(50)
);

CREATE TABLE suppliers (
    supp_id NUMBER(10),
    supp_name VARCHAR2(100),
    contact VARCHAR2(100),
    city VARCHAR2(50)
);

CREATE TABLE test_datatypes (
    col_number NUMBER(10,2),
    col_varchar2 VARCHAR2(100),
    col_char CHAR(10),
    col_date DATE,
    col_timestamp TIMESTAMP,
    col_clob CLOB,
    col_raw RAW(100),
    col_float FLOAT,
    col_integer INTEGER,
    col_nvarchar2 NVARCHAR2(100),
    col_nchar NCHAR(10)
);

-- ============================================
-- BASIC INDEX CREATION
-- ============================================

-- Simple B-tree index (default type, named)
CREATE INDEX idx_cust_id ON customers(cust_id);

-- Simple UNIQUE index
CREATE UNIQUE INDEX idx_cust_email ON customers(email);

-- Bitmap index (suitable for low-cardinality columns)
CREATE BITMAP INDEX idx_cust_status ON customers(status);

-- ============================================
-- COMPOSITE INDEXES
-- ============================================

-- Composite B-tree index (multiple columns)
CREATE INDEX idx_inv_item_price ON inventory(item_name, price);

-- Composite UNIQUE index
CREATE UNIQUE INDEX idx_ship_cust_date ON shipments(customer_id, ship_date);

-- Composite bitmap index (for low-cardinality columns)
CREATE BITMAP INDEX idx_inv_category_stock ON inventory(category, stock_level);

-- ============================================
-- FUNCTION-BASED INDEXES
-- ============================================

-- Function-based B-tree index
CREATE INDEX idx_cust_name_upper ON customers(UPPER(cust_name));

-- Function-based UNIQUE index
CREATE UNIQUE INDEX idx_cust_email_lower ON customers(LOWER(email));

-- Function-based composite index
CREATE INDEX idx_inv_name_price ON inventory(UPPER(item_name), price * 1.1);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Index with very long name
CREATE INDEX idx_very_long_index_name_for_testing_parser_limits ON customers(cust_id);

-- Bitmap index on high-cardinality column (unusual but valid)
CREATE BITMAP INDEX idx_cust_id_bitmap ON customers(cust_id);

-- Function-based index with complex expression
CREATE INDEX idx_cust_complex ON customers(TO_CHAR(reg_date, 'YYYYMM') || cust_name);

-- Index on nullable column
CREATE INDEX idx_ship_nullable ON shipments(customer_id);

-- Composite index with multiple data types
CREATE INDEX idx_dt_mixed ON test_datatypes(col_number, col_varchar2, col_date);

-- Note: Hash indexes are not directly supported in Oracle; B-tree is used instead
-- For hash-like behavior, Oracle uses hash-partitioned indexes or function-based indexes
CREATE INDEX idx_inv_hash_like ON inventory(ORA_HASH(item_name));
