-- MySQL CREATE TABLE Test Cases with Various Table Names
-- Test cases covering table creation with different naming conventions, including schema names, special characters, quoted identifiers, and edge cases
-- Each table uses unique columns and configurations to avoid repetition, with minimal constraints to focus on table naming

-- ============================================
-- BASIC TABLE NAMING
-- ============================================

-- Simple table name without schema
CREATE TABLE customers (
    cust_id INT,
    cust_name VARCHAR(100)
);

-- Table name with schema prefix
CREATE TABLE hr.employees (
    emp_id INT,
    emp_name VARCHAR(100)
);

-- Table name with uppercase
CREATE TABLE INVENTORY (
    item_id INT,
    item_name VARCHAR(200)
);

-- Table name with lowercase
CREATE TABLE shipments (
    ship_id INT,
    customer_id INT
);

-- ============================================
-- TABLE NAMES WITH SPECIAL CHARACTERS
-- ============================================

-- Table name with backticks
CREATE TABLE `Customer Data` (
    data_id INT,
    data_value VARCHAR(100)
);

-- Table name with special characters (underscore, dollar)
CREATE TABLE `order_details$test` (
    order_id INT,
    detail_desc VARCHAR(200)
);

-- Table name with mixed special characters
CREATE TABLE `sales#report@2023` (
    report_id INT,
    report_date DATE
);

-- ============================================
-- TABLE NAMES WITH SCHEMA AND SPECIAL CHARACTERS
-- ============================================

-- Schema with simple table name
CREATE TABLE sales.departments (
    dept_id INT,
    dept_name VARCHAR(100)
);

-- Schema with quoted table name containing spaces
CREATE TABLE hr.`Employee Records` (
    record_id INT,
    record_status VARCHAR(20)
);

-- Schema with special characters in table name
CREATE TABLE finance.`budget_report#2023` (
    budget_id INT,
    amount DECIMAL(12,2)
);

-- ============================================
-- LONG AND COMPLEX TABLE NAMES
-- ============================================

-- Long table name
CREATE TABLE `very_long_table_name_for_testing_parser_limits_1234567890` (
    id INT,
    description TEXT
);

-- Table name with mixed case and spaces
CREATE TABLE `Sales Report Data 2023` (
    sales_id INT,
    sales_amount DECIMAL(12,2)
);

-- ============================================
-- TABLE NAMES WITH CONSTRAINTS
-- ============================================

-- Table with PRIMARY KEY
CREATE TABLE `project_tasks#1` (
    task_id INT PRIMARY KEY,
    task_name VARCHAR(100)
);

-- Table with FOREIGN KEY and quoted name
CREATE TABLE `order details` (
    order_id INT,
    cust_id INT,
    order_date DATE,
    CONSTRAINT fk_order_cust FOREIGN KEY (cust_id) REFERENCES customers(cust_id)
);

-- Table with NOT NULL
CREATE TABLE hr.`Employee_Contracts_2023` (
    contract_id INT NOT NULL,
    emp_name VARCHAR(100) NOT NULL
);

-- Table with DEFAULT
CREATE TABLE `supplier_data` (
    supp_id INT,
    supp_name VARCHAR(100) DEFAULT 'Anonymous'
);

-- ============================================
-- TABLE NAMES WITH ENGINE AND CHARSET
-- ============================================

-- Table with ENGINE specification
CREATE TABLE `Sales Data Archive` (
    archive_id INT,
    archive_date DATE
) ENGINE=InnoDB;

-- Table with CHARSET
CREATE TABLE `customer_info_utf8` (
    cust_id INT,
    cust_name VARCHAR(100)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Table with ENGINE and CHARSET
CREATE TABLE products (
    product_id INT,
    product_name VARCHAR(200),
    price DECIMAL(10,2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- TEMPORARY TABLES
-- ============================================

-- Temporary table
CREATE TEMPORARY TABLE `Temp Customer Data` (
    temp_id INT,
    temp_name VARCHAR(100)
);

-- ============================================
-- TABLE NAMES WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE `Test Data Types#2023` (
    col_int INT NOT NULL,
    col_varchar VARCHAR(100),
    col_text TEXT,
    col_date DATE PRIMARY KEY,
    col_datetime DATETIME,
    col_timestamp TIMESTAMP,
    col_decimal DECIMAL(10,2),
    col_float FLOAT,
    col_double DOUBLE,
    col_boolean BOOLEAN,
    col_blob BLOB
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Table with reserved word as name (quoted)
CREATE TABLE `TABLE` (
    table_id INT,
    table_name VARCHAR(100)
);

-- Table with mixed case, spaces, and special characters
CREATE TABLE `Sales Report#Data 2023@Prod` (
    sales_id INT,
    sales_amount DECIMAL(12,2)
);

-- Table with composite PRIMARY KEY
CREATE TABLE `Order Details#2023` (
    order_id INT,
    item_id INT,
    quantity INT,
    CONSTRAINT pk_order_details PRIMARY KEY (order_id, item_id)
);

-- Table with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE
);

-- Table with AUTO_INCREMENT
CREATE TABLE logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    log_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
