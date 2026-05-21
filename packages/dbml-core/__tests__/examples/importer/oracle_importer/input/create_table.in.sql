-- Oracle SQL CREATE TABLE Test Cases with Various Table Names
-- Test cases covering table creation with different naming conventions, including schema names, special characters, quoted identifiers, and edge cases
-- Each table uses unique columns and configurations to avoid repetition, with minimal constraints to focus on table naming

-- ============================================
-- BASIC TABLE NAMING
-- ============================================

-- Simple table name without schema
CREATE TABLE customers (
    cust_id NUMBER(10),
    cust_name VARCHAR2(100)
);

-- Table name with schema prefix
CREATE TABLE hr.employees (
    emp_id NUMBER(10),
    emp_name VARCHAR2(100)
);

-- Table name with uppercase
CREATE TABLE INVENTORY (
    item_id NUMBER(10),
    item_name VARCHAR2(200)
);

-- Table name with lowercase
CREATE TABLE shipments (
    ship_id NUMBER(10),
    customer_id NUMBER(10)
);

-- ============================================
-- TABLE NAMES WITH SPECIAL CHARACTERS
-- ============================================

-- Table name with spaces (quoted identifier)
CREATE TABLE "Customer Data" (
    data_id NUMBER(10),
    data_value VARCHAR2(100)
);

-- Table name with special characters (e.g., hyphen, underscore, dollar)
CREATE TABLE "order-details$test" (
    order_id NUMBER(10),
    detail_desc VARCHAR2(200)
);

-- Table name with mixed special characters
CREATE TABLE "sales#report@2023" (
    report_id NUMBER(10),
    report_date DATE
);

-- Table name with non-ASCII characters
CREATE TABLE "客户信息" (
    client_id NUMBER(10),
    client_name NVARCHAR2(100)
);

-- ============================================
-- TABLE NAMES WITH SCHEMA AND SPECIAL CHARACTERS
-- ============================================

-- Schema with simple table name
CREATE TABLE sales.departments (
    dept_id NUMBER(10),
    dept_name VARCHAR2(100)
);

-- Schema with quoted table name containing spaces
CREATE TABLE hr."Employee Records" (
    record_id NUMBER(10),
    record_status VARCHAR2(20)
);

-- Schema with special characters in table name
CREATE TABLE finance."budget-report#2023" (
    budget_id NUMBER(10),
    amount NUMBER(12,2)
);

-- Schema with non-ASCII table name
CREATE TABLE global."製品データ" (
    product_id NUMBER(10),
    product_name NVARCHAR2(200)
);

-- ============================================
-- LONG AND COMPLEX TABLE NAMES
-- ============================================

-- Maximum length table name (30 bytes in Oracle 12c and earlier, 128 bytes in 12.2+)
CREATE TABLE "very_long_table_name_for_testing_parser_limits_1234567890" (
    id NUMBER(10),
    description VARCHAR2(4000)
);

-- Table name with mixed case and spaces
CREATE TABLE "Sales Report Data 2023" (
    sales_id NUMBER(10),
    sales_amount NUMBER(12,2)
);

-- Table name with multiple special characters
CREATE TABLE "test@#$%^&*_table!" (
    test_id NUMBER(10),
    test_value VARCHAR2(100)
);

-- ============================================
-- TABLE NAMES WITH CONSTRAINTS
-- ============================================

-- Table with PRIMARY KEY and special name
CREATE TABLE "project_tasks#1" (
    task_id NUMBER(10) PRIMARY KEY,
    task_name VARCHAR2(100)
);

-- Table with FOREIGN KEY and quoted name
CREATE TABLE "order details" (
    order_id NUMBER(10),
    cust_id NUMBER(10) CONSTRAINT fk_order_cust REFERENCES customers(cust_id),
    order_date DATE
);

-- Table with NOT NULL and schema-qualified special name
CREATE TABLE hr."Employee_Contracts_2023" (
    contract_id NUMBER(10) NOT NULL,
    emp_name VARCHAR2(100) NOT NULL
);

-- Table with DEFAULT and non-ASCII name
CREATE TABLE "供应商数据" (
    supp_id NUMBER(10),
    supp_name VARCHAR2(100) DEFAULT 'Anonymous'
);

-- ============================================
-- TABLE NAMES WITH STORAGE AND PARTITIONING
-- ============================================

-- Table with TABLESPACE and quoted name
CREATE TABLE "Sales Data Archive" (
    archive_id NUMBER(10),
    archive_date DATE
) TABLESPACE archive_ts;

-- Range-partitioned table with special name
CREATE TABLE "orders-2023-range" (
    order_id NUMBER(10),
    order_date DATE,
    total_amount NUMBER(12,2)
) PARTITION BY RANGE (order_date) (
    PARTITION p1 VALUES LESS THAN (TO_DATE('2023-01-01', 'YYYY-MM-DD')),
    PARTITION p2 VALUES LESS THAN (TO_DATE('2024-01-01', 'YYYY-MM-DD')),
    PARTITION p3 VALUES LESS THAN (MAXVALUE)
);

-- List-partitioned table with schema and special name
CREATE TABLE sales."Customer_Regions#List" (
    cust_id NUMBER(10),
    region VARCHAR2(50)
) PARTITION BY LIST (region) (
    PARTITION p_north VALUES ('North'),
    PARTITION p_south VALUES ('South'),
    PARTITION p_east VALUES ('East'),
    PARTITION p_west VALUES ('West')
);

-- Hash-partitioned table with quoted name
CREATE TABLE "inventory_hash@test" (
    item_id NUMBER(10),
    item_name VARCHAR2(200)
) PARTITION BY HASH (item_id) (
    PARTITION p1,
    PARTITION p2,
    PARTITION p3,
    PARTITION p4
);

-- ============================================
-- TABLE NAMES WITH TEMPORARY AND EXTERNAL OPTIONS
-- ============================================

-- Global temporary table with quoted name
CREATE GLOBAL TEMPORARY TABLE "Temp Customer Data" (
    temp_id NUMBER(10),
    temp_name VARCHAR2(100)
) ON COMMIT PRESERVE ROWS;

-- External table with special name
CREATE TABLE "external_logs#2023" (
    log_id NUMBER(10),
    log_message VARCHAR2(4000)
) ORGANIZATION EXTERNAL (
    TYPE ORACLE_LOADER
    DEFAULT DIRECTORY data_dir
    ACCESS PARAMETERS (
        RECORDS DELIMITED BY NEWLINE
        FIELDS TERMINATED BY ','
    )
    LOCATION ('logs.csv')
);

-- Index-organized table with schema and special name
CREATE TABLE hr."Employee_IOT@Data" (
    emp_id NUMBER(10) PRIMARY KEY,
    emp_name VARCHAR2(100)
) ORGANIZATION INDEX;

-- ============================================
-- TABLE NAMES WITH CONSTRAINT OPTIONS
-- ============================================

-- Table with ENABLE VALIDATE and quoted name
CREATE TABLE "Project Tasks#Validated" (
    task_id NUMBER(10) PRIMARY KEY ENABLE VALIDATE,
    task_name VARCHAR2(100) NOT NULL ENABLE VALIDATE
);

-- Table with DISABLE NOVALIDATE and special name
CREATE TABLE "Tasks#NonValidated" (
    task_id NUMBER(10) PRIMARY KEY DISABLE NOVALIDATE,
    priority NUMBER(2) NOT NULL DISABLE NOVALIDATE
);

-- Table with RELY and schema-qualified name
CREATE TABLE sales."Orders_Rely#2023" (
    order_id NUMBER(10) PRIMARY KEY RELY,
    order_amount NUMBER(12,2) NOT NULL RELY
);

-- Table with NORELY and quoted name
CREATE TABLE "Suppliers_Norely@Data" (
    supp_id NUMBER(10) PRIMARY KEY NORELY,
    supp_contact VARCHAR2(100) NOT NULL NORELY
);

-- Table with DEFERRABLE and special name
CREATE TABLE "Contracts@Defer" (
    contract_id NUMBER(10) PRIMARY KEY DEFERRABLE INITIALLY DEFERRED,
    contract_name VARCHAR2(100) NOT NULL DEFERRABLE INITIALLY DEFERRED
);

-- Table with NOT DEFERRABLE and quoted name
CREATE TABLE "Tickets#NonDefer" (
    ticket_id NUMBER(10) PRIMARY KEY NOT DEFERRABLE,
    ticket_type VARCHAR2(20) NOT NULL NOT DEFERRABLE
);

-- ============================================
-- TABLE NAMES WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE "Test Data Types#2023" (
    col_number NUMBER(10,2) NOT NULL,
    col_varchar2 VARCHAR2(100) UNIQUE,
    col_char CHAR(10) DEFAULT 'DEFAULT   ',
    col_date DATE PRIMARY KEY,
    col_timestamp TIMESTAMP,
    col_clob CLOB,
    col_raw RAW(100),
    col_float FLOAT,
    col_integer INTEGER,
    col_nvarchar2 NVARCHAR2(100),
    col_nchar NCHAR(10)
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Table with maximum length name (128 bytes in Oracle 12.2+)
CREATE TABLE "very_long_table_name_1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678" (
    id NUMBER(10),
    value VARCHAR2(100)
);

-- Table with reserved word as name (quoted)
CREATE TABLE "TABLE" (
    table_id NUMBER(10),
    table_name VARCHAR2(100)
);

-- Table with special characters and spaces in schema and table name
CREATE TABLE "hr data"."Employee Data#Report$2023" (
    report_id NUMBER(10),
    report_value VARCHAR2(200)
);

-- Table with Unicode characters in schema and table name
CREATE TABLE "グローバル"."製品情報@データ" (
    prod_id NUMBER(10),
    prod_name NVARCHAR2(200)
);

-- Table with mixed case, spaces, and special characters
CREATE TABLE "Sales Report#Data 2023@Prod" (
    sales_id NUMBER(10),
    sales_amount NUMBER(12,2)
);

-- Table with temporary storage and special name
CREATE GLOBAL TEMPORARY TABLE "Temp#Customer_Records" (
    temp_id NUMBER(10) PRIMARY KEY,
    temp_name VARCHAR2(100) NOT NULL
) ON COMMIT DELETE ROWS;

-- Table with composite PRIMARY KEY and quoted name
CREATE TABLE "Order Details#2023" (
    order_id NUMBER(10),
    item_id NUMBER(10),
    quantity NUMBER(10),
    CONSTRAINT pk_order_details PRIMARY KEY (order_id, item_id)
);
