-- Oracle SQL Out-of-Line UNIQUE Constraint Test Cases
-- Test cases covering out-of-line UNIQUE constraints in table definitions, including nameless, named, simple, and composite constraints
-- Each table uses unique columns and constraints to avoid repetition, with constraints applied to different columns across cases

-- ============================================
-- UNIQUE ON DIFFERENT DATA TYPES
-- ============================================

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
    col_nchar NCHAR(10),
    CONSTRAINT uk_number UNIQUE (col_number),
    CONSTRAINT uk_varchar2 UNIQUE (col_varchar2),
    CONSTRAINT uk_char UNIQUE (col_char),
    CONSTRAINT uk_date UNIQUE (col_date),
    CONSTRAINT uk_timestamp UNIQUE (col_timestamp),
    CONSTRAINT uk_clob UNIQUE (col_clob),
    CONSTRAINT uk_raw UNIQUE (col_raw),
    CONSTRAINT uk_float UNIQUE (col_float),
    CONSTRAINT uk_integer UNIQUE (col_integer),
    CONSTRAINT uk_nvarchar2 UNIQUE (col_nvarchar2),
    CONSTRAINT uk_nchar UNIQUE (col_nchar)
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Composite UNIQUE with multiple columns
CREATE TABLE order_details (
    order_id NUMBER(10),
    item_id NUMBER(10),
    quantity NUMBER(10),
    order_ref VARCHAR2(20),
    CONSTRAINT uk_order_ref UNIQUE (order_id, item_id)
);

-- UNIQUE with long constraint name
CREATE TABLE reports (
    report_id NUMBER(10),
    report_name VARCHAR2(100),
    report_date DATE,
    report_code VARCHAR2(20),
    CONSTRAINT uk_very_long_constraint_name_for_testing_parser_limits UNIQUE (report_code)
);

-- UNIQUE with combined options
CREATE TABLE sales (
    sale_id NUMBER(10),
    sale_date DATE,
    sale_code VARCHAR2(20),
    CONSTRAINT uk_sale_code UNIQUE (sale_code) ENABLE VALIDATE RELY
);

-- UNIQUE with DISABLE NOVALIDATE NORELY
CREATE TABLE accounts (
    account_id NUMBER(10),
    account_number VARCHAR2(20),
    balance NUMBER(12,2),
    CONSTRAINT uk_account_number UNIQUE (account_number) DISABLE NOVALIDATE NORELY
);
