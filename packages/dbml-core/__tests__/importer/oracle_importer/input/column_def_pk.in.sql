-- Oracle SQL Inline PRIMARY KEY Constraint Test Cases
-- Test setup: Create tables with inline PRIMARY KEY constraints on different columns
CREATE TABLE customers (
    cust_id NUMBER(10) PRIMARY KEY,
    cust_name VARCHAR2(100),
    email VARCHAR2(100),
    phone VARCHAR2(20)
);

CREATE TABLE inventory (
    item_id NUMBER(10) PRIMARY KEY,
    item_name VARCHAR2(200),
    price NUMBER(10,2),
    category VARCHAR2(50)
);

CREATE TABLE shipments (
    ship_id NUMBER(10) PRIMARY KEY,
    customer_id NUMBER(10),
    ship_date DATE,
    total_amount NUMBER(12,2)
);

CREATE TABLE departments (
    dept_id NUMBER(10) PRIMARY KEY,
    dept_name VARCHAR2(100),
    manager_id NUMBER(10),
    budget NUMBER(12,2)
);

CREATE TABLE suppliers (
    supp_id NUMBER(10) PRIMARY KEY,
    supp_name VARCHAR2(100),
    contact VARCHAR2(100),
    credit_limit NUMBER(10,2)
);

CREATE TABLE test_datatypes (
    col_number NUMBER(10,2) PRIMARY KEY,
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
-- BASIC INLINE PRIMARY KEY CONSTRAINTS
-- ============================================

-- Simple PRIMARY KEY constraint
CREATE TABLE test_basic (
    id NUMBER(10) PRIMARY KEY,
    value NUMBER(10)
);

-- PRIMARY KEY with named constraint
CREATE TABLE test_named (
    code NUMBER(10) CONSTRAINT pk_code PRIMARY KEY,
    description VARCHAR2(200)
);

-- PRIMARY KEY on VARCHAR2
CREATE TABLE test_status (
    status_code VARCHAR2(20) CONSTRAINT pk_status_code PRIMARY KEY,
    status_desc VARCHAR2(100)
);

-- PRIMARY KEY on DATE
CREATE TABLE test_dates (
    event_date DATE CONSTRAINT pk_event_date PRIMARY KEY,
    event_desc VARCHAR2(200)
);

-- ============================================
-- PRIMARY KEY WITH ENABLE/DISABLE
-- ============================================

-- PRIMARY KEY with ENABLE
CREATE TABLE test_enable (
    level NUMBER(2) PRIMARY KEY ENABLE,
    level_desc VARCHAR2(50)
);

-- PRIMARY KEY with DISABLE
CREATE TABLE test_disable (
    priority NUMBER(2) PRIMARY KEY DISABLE,
    priority_desc VARCHAR2(50)
);

-- PRIMARY KEY with ENABLE VALIDATE
CREATE TABLE test_validate (
    amount NUMBER(10,2) PRIMARY KEY ENABLE VALIDATE,
    amount_desc VARCHAR2(100)
);

-- PRIMARY KEY with ENABLE NOVALIDATE
CREATE TABLE test_novalidate (
    discount NUMBER(10,2) PRIMARY KEY ENABLE NOVALIDATE,
    discount_desc VARCHAR2(100)
);

-- PRIMARY KEY with DISABLE NOVALIDATE
CREATE TABLE test_disable_novalidate (
    weight NUMBER(8,2) PRIMARY KEY DISABLE NOVALIDATE,
    weight_desc VARCHAR2(100)
);

-- ============================================
-- PRIMARY KEY WITH RELY/NORELY
-- ============================================

-- PRIMARY KEY with RELY
CREATE TABLE test_rely (
    code NUMBER(10) PRIMARY KEY RELY,
    code_desc VARCHAR2(50)
);

-- PRIMARY KEY with NORELY
CREATE TABLE test_norely (
    sequence NUMBER(10) PRIMARY KEY NORELY,
    sequence_desc VARCHAR2(50)
);

-- PRIMARY KEY with ENABLE RELY
CREATE TABLE test_enable_rely (
    batch_id NUMBER(10) PRIMARY KEY ENABLE RELY,
    batch_desc VARCHAR2(50)
);

-- PRIMARY KEY with DISABLE NORELY
CREATE TABLE test_disable_norely (
    zone_id NUMBER(5) PRIMARY KEY DISABLE NORELY,
    zone_desc VARCHAR2(50)
);

-- ============================================
-- PRIMARY KEY WITH DEFERRABLE OPTIONS
-- ============================================

-- PRIMARY KEY with DEFERRABLE INITIALLY DEFERRED
CREATE TABLE test_deferrable_deferred (
    order_id NUMBER(10) PRIMARY KEY DEFERRABLE INITIALLY DEFERRED,
    order_desc VARCHAR2(100)
);

-- PRIMARY KEY with DEFERRABLE INITIALLY IMMEDIATE
CREATE TABLE test_deferrable_immediate (
    invoice_id NUMBER(10) PRIMARY KEY DEFERRABLE INITIALLY IMMEDIATE,
    invoice_desc VARCHAR2(100)
);

-- PRIMARY KEY with NOT DEFERRABLE
CREATE TABLE test_not_deferrable (
    ticket_id NUMBER(10) PRIMARY KEY NOT DEFERRABLE,
    ticket_desc VARCHAR2(100)
);

-- ============================================
-- PRIMARY KEY ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes_inline (
    col_number NUMBER(10,2) PRIMARY KEY,
    col_varchar2 VARCHAR2(100),
    col_char CHAR(10) PRIMARY KEY,
    col_date DATE PRIMARY KEY,
    col_timestamp TIMESTAMP PRIMARY KEY,
    col_clob CLOB PRIMARY KEY,
    col_raw RAW(100) PRIMARY KEY,
    col_float FLOAT PRIMARY KEY,
    col_integer INTEGER PRIMARY KEY,
    col_nvarchar2 NVARCHAR2(100) PRIMARY KEY,
    col_nchar NCHAR(10) PRIMARY KEY
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- PRIMARY KEY with named constraint and long name
CREATE TABLE test_long_name (
    identifier NUMBER(10) CONSTRAINT pk_very_long_constraint_name_for_testing_parser_limits PRIMARY KEY,
    record_code VARCHAR2(20)
);

-- PRIMARY KEY with combined options
CREATE TABLE test_complex (
    score NUMBER(3) PRIMARY KEY ENABLE VALIDATE RELY,
    rating VARCHAR2(20) PRIMARY KEY DISABLE NOVALIDATE NORELY
);
