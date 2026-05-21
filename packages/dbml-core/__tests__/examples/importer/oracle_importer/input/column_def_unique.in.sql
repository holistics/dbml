-- Oracle SQL Inline UNIQUE Constraint Test Cases
-- Test setup: Create tables with inline UNIQUE constraints on different columns
CREATE TABLE customers (
    cust_id NUMBER(10) UNIQUE,
    cust_name VARCHAR2(100) UNIQUE,
    email VARCHAR2(100) UNIQUE,
    phone VARCHAR2(20) UNIQUE
);

CREATE TABLE inventory (
    item_id NUMBER(10) UNIQUE,
    item_name VARCHAR2(200) UNIQUE,
    price NUMBER(10,2),
    sku VARCHAR2(50) UNIQUE
);

CREATE TABLE shipments (
    ship_id NUMBER(10) UNIQUE,
    customer_id NUMBER(10),
    ship_date DATE UNIQUE,
    tracking_number VARCHAR2(50) UNIQUE
);

CREATE TABLE departments (
    dept_id NUMBER(10) UNIQUE,
    dept_name VARCHAR2(100) UNIQUE,
    manager_id NUMBER(10) UNIQUE,
    budget NUMBER(12,2)
);

CREATE TABLE suppliers (
    supp_id NUMBER(10) UNIQUE,
    supp_name VARCHAR2(100) UNIQUE,
    contact VARCHAR2(100) UNIQUE,
    ssn VARCHAR2(11) UNIQUE
);

CREATE TABLE test_datatypes (
    col_number NUMBER(10,2) UNIQUE,
    col_varchar2 VARCHAR2(100) UNIQUE,
    col_char CHAR(10) UNIQUE,
    col_date DATE UNIQUE,
    col_timestamp TIMESTAMP UNIQUE,
    col_clob CLOB UNIQUE,
    col_raw RAW(100) UNIQUE,
    col_float FLOAT UNIQUE,
    col_integer INTEGER UNIQUE,
    col_nvarchar2 NVARCHAR2(100) UNIQUE,
    col_nchar NCHAR(10) UNIQUE
);

-- ============================================
-- BASIC INLINE UNIQUE CONSTRAINTS
-- ============================================

-- Simple UNIQUE constraint
CREATE TABLE test_basic (
    id NUMBER(10) UNIQUE,
    value NUMBER(10) UNIQUE
);

-- UNIQUE with named constraint
CREATE TABLE test_named (
    code VARCHAR2(20) CONSTRAINT uk_code UNIQUE,
    ref_id NUMBER(10) CONSTRAINT uk_ref_id UNIQUE
);

-- UNIQUE on VARCHAR2
CREATE TABLE test_status (
    status VARCHAR2(20) CONSTRAINT uk_status UNIQUE,
    status_code VARCHAR2(10) CONSTRAINT uk_status_code UNIQUE
);

-- UNIQUE on DATE
CREATE TABLE test_dates (
    event_date DATE CONSTRAINT uk_event_date UNIQUE,
    end_date DATE CONSTRAINT uk_end_date UNIQUE
);

-- ============================================
-- UNIQUE WITH ENABLE/DISABLE
-- ============================================

-- UNIQUE with ENABLE
CREATE TABLE test_enable (
    level NUMBER(2) UNIQUE ENABLE,
    rating NUMBER(2) UNIQUE ENABLE
);

-- UNIQUE with DISABLE
CREATE TABLE test_disable (
    priority NUMBER(2) UNIQUE DISABLE,
    rank NUMBER(2) UNIQUE DISABLE
);

-- UNIQUE with ENABLE VALIDATE
CREATE TABLE test_validate (
    amount NUMBER(10,2) UNIQUE ENABLE VALIDATE,
    tax NUMBER(10,2) UNIQUE ENABLE VALIDATE
);

-- UNIQUE with ENABLE NOVALIDATE
CREATE TABLE test_novalidate (
    discount NUMBER(10,2) UNIQUE ENABLE NOVALIDATE,
    margin NUMBER(10,2) UNIQUE ENABLE NOVALIDATE
);

-- UNIQUE with DISABLE NOVALIDATE
CREATE TABLE test_disable_novalidate (
    weight NUMBER(8,2) UNIQUE DISABLE NOVALIDATE,
    volume NUMBER(8,2) UNIQUE DISABLE NOVALIDATE
);

-- ============================================
-- UNIQUE WITH RELY/NORELY
-- ============================================

-- UNIQUE with RELY
CREATE TABLE test_rely (
    code NUMBER(10) UNIQUE RELY,
    ref_id NUMBER(10) UNIQUE RELY
);

-- UNIQUE with NORELY
CREATE TABLE test_norely (
    sequence NUMBER(10) UNIQUE NORELY,
    counter NUMBER(10) UNIQUE NORELY
);

-- UNIQUE with ENABLE RELY
CREATE TABLE test_enable_rely (
    batch_id NUMBER(10) UNIQUE ENABLE RELY,
    lot_number VARCHAR2(20) UNIQUE ENABLE RELY
);

-- UNIQUE with DISABLE NORELY
CREATE TABLE test_disable_norely (
    zone_id NUMBER(5) UNIQUE DISABLE NORELY,
    area_code VARCHAR2(10) UNIQUE DISABLE NORELY
);

-- ============================================
-- UNIQUE WITH DEFERRABLE OPTIONS
-- ============================================

-- UNIQUE with DEFERRABLE INITIALLY DEFERRED
CREATE TABLE test_deferrable_deferred (
    order_id NUMBER(10) UNIQUE DEFERRABLE INITIALLY DEFERRED,
    line_item NUMBER(5) UNIQUE DEFERRABLE INITIALLY DEFERRED
);

-- UNIQUE with DEFERRABLE INITIALLY IMMEDIATE
CREATE TABLE test_deferrable_immediate (
    invoice_id NUMBER(10) UNIQUE DEFERRABLE INITIALLY IMMEDIATE,
    payment_status VARCHAR2(20) UNIQUE DEFERRABLE INITIALLY IMMEDIATE
);

-- UNIQUE with NOT DEFERRABLE
CREATE TABLE test_not_deferrable (
    ticket_id NUMBER(10) UNIQUE NOT DEFERRABLE,
    issue_date DATE UNIQUE NOT DEFERRABLE
);

-- ============================================
-- UNIQUE ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes_inline (
    col_number NUMBER(10,2) UNIQUE,
    col_varchar2 VARCHAR2(100) UNIQUE,
    col_char CHAR(10) UNIQUE,
    col_date DATE UNIQUE,
    col_timestamp TIMESTAMP UNIQUE,
    col_clob CLOB UNIQUE,
    col_raw RAW(100) UNIQUE,
    col_float FLOAT UNIQUE,
    col_integer INTEGER UNIQUE,
    col_nvarchar2 NVARCHAR2(100) UNIQUE,
    col_nchar NCHAR(10) UNIQUE
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- UNIQUE with named constraint and long name
CREATE TABLE test_long_name (
    identifier NUMBER(10) CONSTRAINT uk_very_long_constraint_name_for_testing_parser_limits UNIQUE,
    record_code VARCHAR2(20) CONSTRAINT uk_record_code_long UNIQUE
);

-- UNIQUE with combined options
CREATE TABLE test_complex (
    score NUMBER(3) UNIQUE ENABLE VALIDATE RELY,
    rating VARCHAR2(20) UNIQUE DISABLE NOVALIDATE NORELY
);
