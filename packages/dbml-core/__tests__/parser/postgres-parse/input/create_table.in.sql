-- PostgreSQL CREATE TABLE Test Cases

-- ============================================
-- BASIC TABLE NAMING
-- ============================================

-- Simple table name
CREATE TABLE customers (
    cust_id INTEGER,
    cust_name VARCHAR(100)
);

-- Table with schema prefix
CREATE SCHEMA IF NOT EXISTS hr;
CREATE TABLE hr.employees (
    emp_id INTEGER,
    emp_name VARCHAR(100)
);

-- Table with uppercase
CREATE TABLE INVENTORY (
    item_id INTEGER,
    item_name VARCHAR(200)
);

-- Table with lowercase
CREATE TABLE shipments (
    ship_id INTEGER,
    customer_id INTEGER
);

-- ============================================
-- TABLE NAMES WITH SPECIAL CHARACTERS
-- ============================================

-- Table name with quotes
CREATE TABLE "Customer Data" (
    data_id INTEGER,
    data_value VARCHAR(100)
);

-- Table name with special characters
CREATE TABLE "order-details$test" (
    order_id INTEGER,
    detail_desc VARCHAR(200)
);

-- Table name with mixed special characters
CREATE TABLE "sales#report@2023" (
    report_id INTEGER,
    report_date DATE
);

-- ============================================
-- TABLE NAMES WITH SCHEMA AND SPECIAL CHARACTERS
-- ============================================

CREATE SCHEMA IF NOT EXISTS sales;
CREATE TABLE sales.departments (
    dept_id INTEGER,
    dept_name VARCHAR(100)
);

-- Schema with quoted table name
CREATE TABLE hr."Employee Records" (
    record_id INTEGER,
    record_status VARCHAR(20)
);

-- Schema with special characters in table name
CREATE SCHEMA IF NOT EXISTS finance;
CREATE TABLE finance."budget_report#2023" (
    budget_id INTEGER,
    amount NUMERIC(12,2)
);

-- ============================================
-- LONG AND COMPLEX TABLE NAMES
-- ============================================

-- Long table name
CREATE TABLE "very_long_table_name_for_testing_parser_limits_1234567890" (
    id INTEGER,
    description TEXT
);

-- Table name with mixed case and spaces
CREATE TABLE "Sales Report Data 2023" (
    sales_id INTEGER,
    sales_amount NUMERIC(12,2)
);

-- ============================================
-- TABLE NAMES WITH CONSTRAINTS
-- ============================================

-- Table with PRIMARY KEY
CREATE TABLE "project_tasks#1" (
    task_id INTEGER PRIMARY KEY,
    task_name VARCHAR(100)
);

-- Table with FOREIGN KEY and quoted name
CREATE TABLE "order details" (
    order_id INTEGER,
    cust_id INTEGER,
    order_date DATE,
    CONSTRAINT fk_order_cust FOREIGN KEY (cust_id) REFERENCES customers(cust_id)
);

-- Table with NOT NULL
CREATE TABLE hr."Employee_Contracts_2023" (
    contract_id INTEGER NOT NULL,
    emp_name VARCHAR(100) NOT NULL
);

-- Table with DEFAULT
CREATE TABLE "supplier_data" (
    supp_id INTEGER,
    supp_name VARCHAR(100) DEFAULT 'Anonymous'
);

-- ============================================
-- TEMPORARY TABLES
-- ============================================

-- Temporary table
CREATE TEMPORARY TABLE "Temp Customer Data" (
    temp_id INTEGER,
    temp_name VARCHAR(100)
);

-- Temp table with ON COMMIT options
CREATE TEMPORARY TABLE temp_orders (
    order_id INTEGER,
    total NUMERIC(10,2)
) ON COMMIT DELETE ROWS;

CREATE TEMPORARY TABLE temp_session (
    session_id INTEGER,
    data TEXT
) ON COMMIT PRESERVE ROWS;

CREATE TEMPORARY TABLE temp_cache (
    cache_key VARCHAR(100),
    cache_value TEXT
) ON COMMIT DROP;

-- ============================================
-- TABLE NAMES WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE "Test Data Types#2023" (
    col_int INTEGER NOT NULL,
    col_varchar VARCHAR(100),
    col_text TEXT,
    col_date DATE PRIMARY KEY,
    col_timestamp TIMESTAMP,
    col_timestamptz TIMESTAMPTZ,
    col_numeric NUMERIC(10,2),
    col_real REAL,
    col_double DOUBLE PRECISION,
    col_boolean BOOLEAN,
    col_bytea BYTEA
);

-- ============================================
-- UNLOGGED TABLES
-- ============================================

-- Unlogged table
CREATE UNLOGGED TABLE fast_logs (
    log_id INTEGER,
    log_message TEXT,
    created_at TIMESTAMP
);

-- ============================================
-- TABLES WITH INHERITANCE
-- ============================================

-- Parent table
CREATE TABLE base_entity (
    id INTEGER PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Child table inheriting from parent
CREATE TABLE users (
    username VARCHAR(50),
    email VARCHAR(100)
) INHERITS (base_entity);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Table with reserved word as name (quoted)
CREATE TABLE "TABLE" (
    table_id INTEGER,
    table_name VARCHAR(100)
);

-- Table with mixed case, spaces, and special characters
CREATE TABLE "Sales Report#Data 2023@Prod" (
    sales_id INTEGER,
    sales_amount NUMERIC(12,2)
);

-- Table with composite PRIMARY KEY
CREATE TABLE "Order Details#2023" (
    order_id INTEGER,
    item_id INTEGER,
    quantity INTEGER,
    CONSTRAINT pk_order_details PRIMARY KEY (order_id, item_id)
);

-- Table with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS users_table (
    user_id INTEGER PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE
);

-- Table with SERIAL (auto-increment)
CREATE TABLE logs (
    log_id SERIAL PRIMARY KEY,
    log_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table with IDENTITY column (PostgreSQL 10+)
CREATE TABLE accounts (
    account_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_name VARCHAR(100)
);

-- Table with GENERATED BY DEFAULT
CREATE TABLE transactions (
    trans_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    amount NUMERIC(10,2)
);

-- Table with tablespace
CREATE TABLE archive_data (
    data_id INTEGER,
    data_value TEXT
) TABLESPACE pg_default;

-- Table with storage parameters
CREATE TABLE optimized_table (
    id INTEGER PRIMARY KEY,
    data TEXT
) WITH (fillfactor=70);

-- Partitioned table (PostgreSQL 10+)
CREATE TABLE measurements (
    measurement_id INTEGER,
    measurement_date DATE NOT NULL,
    value NUMERIC(10,2)
) PARTITION BY RANGE (measurement_date);
