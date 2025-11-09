-- Snowflake Inline Column PRIMARY KEY Test Cases

-- ============================================
-- BASIC INLINE PRIMARY KEY
-- ============================================

-- Simple NUMBER PRIMARY KEY
CREATE TABLE test_pk_number (
    id NUMBER PRIMARY KEY,
    name VARCHAR(100)
);

-- VARCHAR PRIMARY KEY
CREATE TABLE test_pk_varchar (
    code VARCHAR(20) PRIMARY KEY,
    description VARCHAR
);

-- ============================================
-- PRIMARY KEY WITH AUTOINCREMENT
-- ============================================

-- AUTOINCREMENT PRIMARY KEY
CREATE TABLE test_pk_auto (
    id NUMBER AUTOINCREMENT PRIMARY KEY,
    data VARCHAR(100)
);

-- PRIMARY KEY with AUTOINCREMENT different start
CREATE TABLE test_pk_auto_start (
    id NUMBER AUTOINCREMENT START 1000 INCREMENT 1 PRIMARY KEY,
    value VARCHAR(100)
);

-- ============================================
-- PRIMARY KEY WITH IDENTITY
-- ============================================

-- IDENTITY PRIMARY KEY
CREATE TABLE test_pk_identity (
    id NUMBER IDENTITY PRIMARY KEY,
    info VARCHAR
);

-- IDENTITY with start and increment
CREATE TABLE test_pk_identity_options (
    id NUMBER IDENTITY(1000,10) PRIMARY KEY,
    data VARCHAR(200)
);

-- ============================================
-- PRIMARY KEY WITH NOT NULL
-- ============================================

-- PRIMARY KEY with explicit NOT NULL
CREATE TABLE test_pk_not_null (
    id NUMBER NOT NULL PRIMARY KEY,
    name VARCHAR(100)
);

-- ============================================
-- PRIMARY KEY WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_pk_string (
    code STRING PRIMARY KEY,
    description VARCHAR(200)
);

CREATE TABLE test_pk_date (
    event_date DATE PRIMARY KEY,
    event_name VARCHAR(100)
);

-- ============================================
-- PRIMARY KEY WITH DEFAULT
-- ============================================

-- PRIMARY KEY with DEFAULT
CREATE TABLE test_pk_default (
    id NUMBER PRIMARY KEY DEFAULT 1,
    name VARCHAR(100)
);

-- PRIMARY KEY with UUID default
CREATE TABLE test_pk_uuid_default (
    id VARCHAR(36) PRIMARY KEY DEFAULT UUID_STRING(),
    data VARCHAR
);

-- ============================================
-- PRIMARY KEY WITH CONSTRAINT NAME
-- ============================================

-- PRIMARY KEY with named constraint
CREATE TABLE test_pk_named (
    id NUMBER CONSTRAINT pk_test PRIMARY KEY,
    value VARCHAR
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Multiple columns, one PRIMARY KEY
CREATE TABLE test_pk_multi_col (
    id NUMBER PRIMARY KEY,
    col1 VARCHAR(50),
    col2 NUMBER,
    col3 DATE
);

-- PRIMARY KEY with quoted identifiers
CREATE TABLE test_pk_quoted (
    "order-id" NUMBER PRIMARY KEY,
    order_date DATE
);

-- Schema-qualified table with PRIMARY KEY
CREATE SCHEMA test_schema;

CREATE TABLE test_schema.test_pk_schema (
    emp_id NUMBER PRIMARY KEY,
    emp_name VARCHAR(100)
);

-- PRIMARY KEY with AUTOINCREMENT and order
CREATE TABLE test_pk_auto_order (
    id NUMBER AUTOINCREMENT ORDER PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PRIMARY KEY with NOORDER
CREATE TABLE test_pk_noorder (
    id NUMBER AUTOINCREMENT NOORDER PRIMARY KEY,
    data VARCHAR(100)
);
