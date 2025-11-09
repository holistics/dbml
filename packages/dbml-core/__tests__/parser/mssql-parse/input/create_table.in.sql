-- MSSQL CREATE TABLE Test Cases

-- ============================================
-- BASIC TABLE NAMING
-- ============================================

-- Simple table name
CREATE TABLE customers (
    cust_id INT,
    cust_name NVARCHAR(100)
);

-- Table with schema prefix
CREATE SCHEMA hr;
GO

CREATE TABLE hr.employees (
    emp_id INT,
    emp_name NVARCHAR(100)
);

-- Table with uppercase
CREATE TABLE INVENTORY (
    item_id INT,
    item_name NVARCHAR(200)
);

-- Table with lowercase
CREATE TABLE shipments (
    ship_id INT,
    customer_id INT
);

-- ============================================
-- TABLE NAMES WITH SPECIAL CHARACTERS
-- ============================================

-- Table name with brackets
CREATE TABLE [Customer Data] (
    data_id INT,
    data_value NVARCHAR(100)
);

-- Table name with special characters
CREATE TABLE [order-details$test] (
    order_id INT,
    detail_desc NVARCHAR(200)
);

-- Table name with mixed special characters
CREATE TABLE [sales#report@2023] (
    report_id INT,
    report_date DATE
);

-- ============================================
-- TABLE NAMES WITH SCHEMA AND SPECIAL CHARACTERS
-- ============================================

CREATE SCHEMA sales;
GO

CREATE TABLE sales.departments (
    dept_id INT,
    dept_name NVARCHAR(100)
);

-- Schema with quoted table name
CREATE TABLE hr.[Employee Records] (
    record_id INT,
    record_status NVARCHAR(20)
);

CREATE SCHEMA finance;
GO

-- Schema with special characters in table name
CREATE TABLE finance.[budget_report#2023] (
    budget_id INT,
    amount DECIMAL(12,2)
);

-- ============================================
-- LONG AND COMPLEX TABLE NAMES
-- ============================================

-- Long table name
CREATE TABLE [very_long_table_name_for_testing_parser_limits_1234567890] (
    id INT,
    description NVARCHAR(MAX)
);

-- Table name with mixed case and spaces
CREATE TABLE [Sales Report Data 2023] (
    sales_id INT,
    sales_amount DECIMAL(12,2)
);

-- ============================================
-- TABLE NAMES WITH CONSTRAINTS
-- ============================================

-- Table with PRIMARY KEY
CREATE TABLE [project_tasks#1] (
    task_id INT PRIMARY KEY,
    task_name NVARCHAR(100)
);

-- Table with FOREIGN KEY and quoted name
CREATE TABLE [order details] (
    order_id INT,
    cust_id INT,
    order_date DATE,
    CONSTRAINT fk_order_cust FOREIGN KEY (cust_id) REFERENCES customers(cust_id)
);

-- Table with NOT NULL
CREATE TABLE hr.[Employee_Contracts_2023] (
    contract_id INT NOT NULL,
    emp_name NVARCHAR(100) NOT NULL
);

-- Table with DEFAULT
CREATE TABLE [supplier_data] (
    supp_id INT,
    supp_name NVARCHAR(100) DEFAULT 'Anonymous'
);

-- ============================================
-- TEMPORARY TABLES
-- ============================================

-- Local temporary table
CREATE TABLE #TempCustomerData (
    temp_id INT,
    temp_name NVARCHAR(100)
);

-- Global temporary table
CREATE TABLE ##GlobalTempData (
    global_id INT,
    global_value NVARCHAR(200)
);

-- ============================================
-- TABLE NAMES WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE [Test Data Types#2023] (
    col_int INT NOT NULL,
    col_varchar NVARCHAR(100),
    col_text NVARCHAR(MAX),
    col_date DATE PRIMARY KEY,
    col_datetime DATETIME,
    col_datetime2 DATETIME2,
    col_decimal DECIMAL(10,2),
    col_float FLOAT,
    col_real REAL,
    col_bit BIT,
    col_binary VARBINARY(MAX)
);

-- ============================================
-- TABLE WITH IDENTITY
-- ============================================

-- Table with IDENTITY
CREATE TABLE logs (
    log_id INT IDENTITY(1,1) PRIMARY KEY,
    log_message NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE()
);

-- Table with IDENTITY starting at different value
CREATE TABLE accounts (
    account_id INT IDENTITY(1000,1) PRIMARY KEY,
    account_name NVARCHAR(100)
);

-- ============================================
-- TABLE WITH FILEGROUP
-- ============================================

-- Table on specific filegroup
CREATE TABLE archive_data (
    data_id INT,
    data_value NVARCHAR(MAX)
) ON [PRIMARY];

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Table with reserved word as name (quoted)
CREATE TABLE [TABLE] (
    table_id INT,
    table_name NVARCHAR(100)
);

-- Table with mixed case, spaces, and special characters
CREATE TABLE [Sales Report#Data 2023@Prod] (
    sales_id INT,
    sales_amount DECIMAL(12,2)
);

-- Table with composite PRIMARY KEY
CREATE TABLE [Order Details#2023] (
    order_id INT,
    item_id INT,
    quantity INT,
    CONSTRAINT pk_order_details PRIMARY KEY (order_id, item_id)
);

-- Table with schema and database prefix
CREATE TABLE dbo.users_table (
    user_id INT PRIMARY KEY,
    username NVARCHAR(50) NOT NULL,
    email NVARCHAR(100) UNIQUE
);

-- Table with column level constraints
CREATE TABLE transactions (
    trans_id INT IDENTITY(1,1) PRIMARY KEY,
    amount DECIMAL(10,2) CHECK (amount > 0),
    trans_date DATETIME DEFAULT GETDATE()
);

-- Table with computed column
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    quantity INT,
    price DECIMAL(10,2),
    total AS (quantity * price)
);

-- Table with persisted computed column
CREATE TABLE invoice_items (
    item_id INT PRIMARY KEY,
    quantity INT,
    unit_price DECIMAL(10,2),
    line_total AS (quantity * unit_price) PERSISTED
);
