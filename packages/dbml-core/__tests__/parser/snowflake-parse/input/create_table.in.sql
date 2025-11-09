-- Snowflake CREATE TABLE Test Cases

-- ============================================
-- BASIC TABLE NAMING
-- ============================================

-- Simple table name
CREATE TABLE customers (
    cust_id NUMBER,
    cust_name VARCHAR(100)
);

-- Table with schema prefix
CREATE SCHEMA hr;

CREATE TABLE hr.employees (
    emp_id NUMBER,
    emp_name VARCHAR(100)
);

-- Table with uppercase
CREATE TABLE INVENTORY (
    item_id NUMBER,
    item_name VARCHAR(200)
);

-- Table with lowercase
CREATE TABLE shipments (
    ship_id NUMBER,
    customer_id NUMBER
);

-- ============================================
-- TABLE NAMES WITH SPECIAL CHARACTERS
-- ============================================

-- Table name with quotes
CREATE TABLE "Customer Data" (
    data_id NUMBER,
    data_value VARCHAR(100)
);

-- Table name with special characters
CREATE TABLE "order-details$test" (
    order_id NUMBER,
    detail_desc VARCHAR(200)
);

-- Table name with mixed special characters
CREATE TABLE "sales#report@2023" (
    report_id NUMBER,
    report_date DATE
);

-- ============================================
-- TABLE NAMES WITH SCHEMA AND SPECIAL CHARACTERS
-- ============================================

CREATE SCHEMA sales;

CREATE TABLE sales.departments (
    dept_id NUMBER,
    dept_name VARCHAR(100)
);

-- Schema with quoted table name
CREATE TABLE hr."Employee Records" (
    record_id NUMBER,
    record_status VARCHAR(20)
);

CREATE SCHEMA finance;

-- Schema with special characters in table name
CREATE TABLE finance."budget_report#2023" (
    budget_id NUMBER,
    amount NUMBER(12,2)
);

-- ============================================
-- LONG AND COMPLEX TABLE NAMES
-- ============================================

-- Long table name
CREATE TABLE "very_long_table_name_for_testing_parser_limits_1234567890" (
    id NUMBER,
    description VARCHAR
);

-- Table name with mixed case and spaces
CREATE TABLE "Sales Report Data 2023" (
    sales_id NUMBER,
    sales_amount NUMBER(12,2)
);

-- ============================================
-- TABLE NAMES WITH CONSTRAINTS
-- ============================================

-- Table with PRIMARY KEY
CREATE TABLE "project_tasks#1" (
    task_id NUMBER PRIMARY KEY,
    task_name VARCHAR(100)
);

-- Table with FOREIGN KEY and quoted name
CREATE TABLE "order details" (
    order_id NUMBER,
    cust_id NUMBER,
    order_date DATE,
    CONSTRAINT fk_order_cust FOREIGN KEY (cust_id) REFERENCES customers(cust_id)
);

-- Table with NOT NULL
CREATE TABLE hr."Employee_Contracts_2023" (
    contract_id NUMBER NOT NULL,
    emp_name VARCHAR(100) NOT NULL
);

-- Table with DEFAULT
CREATE TABLE "supplier_data" (
    supp_id NUMBER,
    supp_name VARCHAR(100) DEFAULT 'Anonymous'
);

-- ============================================
-- TEMPORARY TABLES
-- ============================================

-- Temporary table
CREATE TEMPORARY TABLE "Temp Customer Data" (
    temp_id NUMBER,
    temp_name VARCHAR(100)
);

-- Temp table with different syntax
CREATE TEMP TABLE temp_orders (
    order_id NUMBER,
    total NUMBER(10,2)
);

-- ============================================
-- TRANSIENT TABLES
-- ============================================

-- Transient table
CREATE TRANSIENT TABLE transient_logs (
    log_id NUMBER,
    log_message VARCHAR,
    created_at TIMESTAMP
);

-- ============================================
-- TABLE NAMES WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE "Test Data Types#2023" (
    col_number NUMBER NOT NULL,
    col_varchar VARCHAR(100),
    col_string STRING,
    col_date DATE PRIMARY KEY,
    col_timestamp TIMESTAMP,
    col_timestamp_ntz TIMESTAMP_NTZ,
    col_timestamp_ltz TIMESTAMP_LTZ,
    col_timestamp_tz TIMESTAMP_TZ,
    col_float FLOAT,
    col_double DOUBLE,
    col_boolean BOOLEAN,
    col_binary BINARY
);

-- ============================================
-- TABLE WITH CLUSTERING
-- ============================================

-- Table with cluster by
CREATE TABLE clustered_table (
    id NUMBER,
    category VARCHAR(50),
    created_date DATE
) CLUSTER BY (category, created_date);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Table with reserved word as name (quoted)
CREATE TABLE "TABLE" (
    table_id NUMBER,
    table_name VARCHAR(100)
);

-- Table with mixed case, spaces, and special characters
CREATE TABLE "Sales Report#Data 2023@Prod" (
    sales_id NUMBER,
    sales_amount NUMBER(12,2)
);

-- Table with composite PRIMARY KEY
CREATE TABLE "Order Details#2023" (
    order_id NUMBER,
    item_id NUMBER,
    quantity NUMBER,
    CONSTRAINT pk_order_details PRIMARY KEY (order_id, item_id)
);

-- Table with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS users_table (
    user_id NUMBER PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE
);

-- Table with IDENTITY/AUTOINCREMENT
CREATE TABLE logs (
    log_id NUMBER AUTOINCREMENT PRIMARY KEY,
    log_message VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table with IDENTITY start and increment
CREATE TABLE accounts (
    account_id NUMBER IDENTITY(1000,1) PRIMARY KEY,
    account_name VARCHAR(100)
);

-- Table with sequence
CREATE SEQUENCE seq_test START 1 INCREMENT 1;

CREATE TABLE seq_table (
    id NUMBER DEFAULT seq_test.NEXTVAL,
    data VARCHAR(100)
);

-- Table with tag
CREATE TABLE tagged_table (
    id NUMBER PRIMARY KEY,
    data VARCHAR(100)
) TAG (department = 'finance', sensitivity = 'high');

-- Table with comment
CREATE TABLE commented_table (
    id NUMBER PRIMARY KEY,
    data VARCHAR(100)
) COMMENT = 'This is a test table with comments';
