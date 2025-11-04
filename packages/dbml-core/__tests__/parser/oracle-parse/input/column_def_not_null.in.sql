-- Oracle SQL Inline NOT NULL Constraint Test Cases
-- Test setup: Create tables with inline NOT NULL constraints on different columns
CREATE TABLE customers (
    cust_id NUMBER(10) NOT NULL,
    cust_name VARCHAR2(100) NOT NULL,
    email VARCHAR2(100) NOT NULL,
    phone VARCHAR2(20) NOT NULL
);

CREATE TABLE inventory (
    item_id NUMBER(10) NOT NULL,
    item_name VARCHAR2(200) NOT NULL,
    price NUMBER(10,2) NOT NULL,
    category VARCHAR2(50) NOT NULL
);

CREATE TABLE shipments (
    ship_id NUMBER(10) NOT NULL,
    customer_id NUMBER(10) NOT NULL,
    ship_date DATE NOT NULL,
    total_amount NUMBER(12,2) NOT NULL
);

CREATE TABLE departments (
    dept_id NUMBER(10) NOT NULL,
    dept_name VARCHAR2(100) NOT NULL,
    manager_id NUMBER(10) NOT NULL,
    budget NUMBER(12,2) NOT NULL
);

CREATE TABLE suppliers (
    supp_id NUMBER(10) NOT NULL,
    supp_name VARCHAR2(100) NOT NULL,
    contact VARCHAR2(100) NOT NULL,
    credit_limit NUMBER(10,2) NOT NULL
);

CREATE TABLE test_datatypes (
    col_number NUMBER(10,2) NOT NULL,
    col_varchar2 VARCHAR2(100) NOT NULL,
    col_char CHAR(10) NOT NULL,
    col_date DATE NOT NULL,
    col_timestamp TIMESTAMP NOT NULL,
    col_clob CLOB NOT NULL,
    col_raw RAW(100) NOT NULL,
    col_float FLOAT NOT NULL,
    col_integer INTEGER NOT NULL,
    col_nvarchar2 NVARCHAR2(100) NOT NULL,
    col_nchar NCHAR(10) NOT NULL
);

-- ============================================
-- BASIC INLINE NOT NULL CONSTRAINTS
-- ============================================

-- Simple NOT NULL constraint
CREATE TABLE test_basic (
    id NUMBER(10) NOT NULL,
    value NUMBER(10) NOT NULL
);

-- NOT NULL on VARCHAR2
CREATE TABLE test_status (
    status VARCHAR2(20) NOT NULL,
    code VARCHAR2(10) NOT NULL
);

-- NOT NULL with named constraint
CREATE TABLE test_named (
    record_id NUMBER(10) CONSTRAINT nn_record_id NOT NULL,
    description VARCHAR2(200) CONSTRAINT nn_description NOT NULL
);

-- NOT NULL on DATE
CREATE TABLE test_dates (
    event_date DATE NOT NULL,
    end_date DATE NOT NULL
);

-- ============================================
-- NOT NULL WITH ENABLE/DISABLE
-- ============================================

-- NOT NULL with ENABLE
CREATE TABLE test_enable (
    level NUMBER(2) NOT NULL ENABLE,
    rating NUMBER(2) NOT NULL ENABLE
);

-- NOT NULL with DISABLE
CREATE TABLE test_disable (
    priority NUMBER(2) NOT NULL DISABLE,
    rank NUMBER(2) NOT NULL DISABLE
);

-- NOT NULL with ENABLE VALIDATE
CREATE TABLE test_validate (
    amount NUMBER(10,2) NOT NULL ENABLE VALIDATE,
    tax NUMBER(10,2) NOT NULL ENABLE VALIDATE
);

-- NOT NULL with ENABLE NOVALIDATE
CREATE TABLE test_novalidate (
    discount NUMBER(10,2) NOT NULL ENABLE NOVALIDATE,
    margin NUMBER(10,2) NOT NULL ENABLE NOVALIDATE
);

-- NOT NULL with DISABLE NOVALIDATE
CREATE TABLE test_disable_novalidate (
    weight NUMBER(8,2) NOT NULL DISABLE NOVALIDATE,
    volume NUMBER(8,2) NOT NULL DISABLE NOVALIDATE
);

-- ============================================
-- NOT NULL WITH RELY/NORELY
-- ============================================

-- NOT NULL with RELY
CREATE TABLE test_rely (
    code NUMBER(10) NOT NULL RELY,
    ref_id NUMBER(10) NOT NULL RELY
);

-- NOT NULL with NORELY
CREATE TABLE test_norely (
    sequence NUMBER(10) NOT NULL NORELY,
    counter NUMBER(10) NOT NULL NORELY
);

-- NOT NULL with ENABLE RELY
CREATE TABLE test_enable_rely (
    batch_id NUMBER(10) NOT NULL ENABLE RELY,
    lot_number VARCHAR2(20) NOT NULL ENABLE RELY
);

-- NOT NULL with DISABLE NORELY
CREATE TABLE test_disable_norely (
    zone_id NUMBER(5) NOT NULL DISABLE NORELY,
    area_code VARCHAR2(10) NOT NULL DISABLE NORELY
);

-- ============================================
-- NOT NULL WITH DEFERRABLE OPTIONS
-- ============================================

-- NOT NULL with DEFERRABLE INITIALLY DEFERRED
CREATE TABLE test_deferrable_deferred (
    order_id NUMBER(10) NOT NULL DEFERRABLE INITIALLY DEFERRED,
    line_item NUMBER(5) NOT NULL DEFERRABLE INITIALLY DEFERRED
);

-- NOT NULL with DEFERRABLE INITIALLY IMMEDIATE
CREATE TABLE test_deferrable_immediate (
    invoice_id NUMBER(10) NOT NULL DEFERRABLE INITIALLY IMMEDIATE,
    payment_status VARCHAR2(20) NOT NULL DEFERRABLE INITIALLY IMMEDIATE
);

-- NOT NULL with NOT DEFERRABLE
CREATE TABLE test_not_deferrable (
    ticket_id NUMBER(10) NOT NULL NOT DEFERRABLE,
    issue_date DATE NOT NULL NOT DEFERRABLE
);

-- ============================================
-- NOT NULL ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes_inline (
    col_number NUMBER(10,2) NOT NULL,
    col_varchar2 VARCHAR2(100) NOT NULL,
    col_char CHAR(10) NOT NULL,
    col_date DATE NOT NULL,
    col_timestamp TIMESTAMP NOT NULL,
    col_clob CLOB NOT NULL,
    col_raw RAW(100) NOT NULL,
    col_float FLOAT NOT NULL,
    col_integer INTEGER NOT NULL,
    col_nvarchar2 NVARCHAR2(100) NOT NULL,
    col_nchar NCHAR(10) NOT NULL
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- NOT NULL with named constraint and long name
CREATE TABLE test_long_name (
    identifier NUMBER(10) CONSTRAINT nn_very_long_constraint_name_for_testing_parser_limits NOT NULL,
    record_code VARCHAR2(20) CONSTRAINT nn_record_code_long NOT NULL
);

-- NOT NULL with combined options
CREATE TABLE test_complex (
    score NUMBER(3) NOT NULL ENABLE VALIDATE RELY,
    rating VARCHAR2(20) NOT NULL DISABLE NOVALIDATE NORELY
);
