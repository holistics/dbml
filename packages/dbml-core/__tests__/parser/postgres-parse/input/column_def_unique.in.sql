-- PostgreSQL Inline Column UNIQUE Test Cases

-- ============================================
-- BASIC INLINE UNIQUE
-- ============================================

-- Simple UNIQUE constraint
CREATE TABLE test_unique_basic (
    id INTEGER PRIMARY KEY,
    email VARCHAR(100) UNIQUE,
    username VARCHAR(50) UNIQUE
);

-- UNIQUE with NOT NULL
CREATE TABLE test_unique_not_null (
    id INTEGER PRIMARY KEY,
    ssn VARCHAR(11) UNIQUE NOT NULL,
    passport VARCHAR(20) UNIQUE NOT NULL
);

-- UNIQUE with constraint name
CREATE TABLE test_unique_named (
    id INTEGER PRIMARY KEY,
    email VARCHAR(100) CONSTRAINT uq_email UNIQUE,
    username VARCHAR(50) CONSTRAINT uq_username UNIQUE
);

-- ============================================
-- UNIQUE WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_unique_int (
    id INTEGER PRIMARY KEY,
    employee_number INTEGER UNIQUE,
    badge_id INTEGER UNIQUE
);

CREATE TABLE test_unique_varchar (
    id INTEGER PRIMARY KEY,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    license_plate VARCHAR(15) UNIQUE
);

CREATE TABLE test_unique_uuid (
    id INTEGER PRIMARY KEY,
    uuid_col UUID UNIQUE
);

CREATE TABLE test_unique_bigint (
    id INTEGER PRIMARY KEY,
    card_number BIGINT UNIQUE,
    account_number BIGINT UNIQUE
);

-- ============================================
-- UNIQUE WITH DEFAULT VALUES
-- ============================================

CREATE TABLE test_unique_default (
    id INTEGER PRIMARY KEY,
    tracking_code VARCHAR(50) UNIQUE DEFAULT gen_random_uuid()::TEXT,
    ref_number VARCHAR(50) UNIQUE
);

-- ============================================
-- UNIQUE WITH SERIAL
-- ============================================

CREATE TABLE test_unique_serial (
    id SERIAL PRIMARY KEY,
    order_number INTEGER UNIQUE,
    invoice_number VARCHAR(50) UNIQUE
);

-- ============================================
-- UNIQUE WITH NULLS
-- ============================================

-- UNIQUE NULLS DISTINCT (PostgreSQL 15+)
CREATE TABLE test_unique_nulls_distinct (
    id INTEGER PRIMARY KEY,
    optional_email VARCHAR(100) UNIQUE NULLS DISTINCT
);

-- UNIQUE NULLS NOT DISTINCT (PostgreSQL 15+)
CREATE TABLE test_unique_nulls_not_distinct (
    id INTEGER PRIMARY KEY,
    optional_code VARCHAR(20) UNIQUE NULLS NOT DISTINCT
);

-- ============================================
-- UNIQUE WITH DEFERRABLE
-- ============================================

-- DEFERRABLE INITIALLY DEFERRED
CREATE TABLE test_unique_deferrable (
    id INTEGER PRIMARY KEY,
    code VARCHAR(20) CONSTRAINT uq_code UNIQUE DEFERRABLE INITIALLY DEFERRED
);

-- DEFERRABLE INITIALLY IMMEDIATE
CREATE TABLE test_unique_deferrable_immediate (
    id INTEGER PRIMARY KEY,
    ref VARCHAR(20) UNIQUE DEFERRABLE INITIALLY IMMEDIATE
);

-- NOT DEFERRABLE
CREATE TABLE test_unique_not_deferrable (
    id INTEGER PRIMARY KEY,
    serial VARCHAR(20) UNIQUE NOT DEFERRABLE
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Multiple UNIQUE constraints on same table
CREATE TABLE test_unique_multiple (
    id INTEGER PRIMARY KEY,
    col1 VARCHAR(50) UNIQUE,
    col2 VARCHAR(50) UNIQUE,
    col3 VARCHAR(50) UNIQUE,
    col4 INTEGER UNIQUE,
    col5 INTEGER UNIQUE
);

-- UNIQUE with quoted identifiers
CREATE TABLE "test-unique-quoted" (
    id INTEGER PRIMARY KEY,
    "email-address" VARCHAR(100) CONSTRAINT "uq-email" UNIQUE,
    "user-name" VARCHAR(50) UNIQUE
);

-- Schema-qualified table with UNIQUE
CREATE SCHEMA IF NOT EXISTS hr;
CREATE TABLE hr.test_unique_schema (
    emp_id INTEGER PRIMARY KEY,
    emp_email VARCHAR(100) UNIQUE,
    emp_badge INTEGER UNIQUE
);

-- UNIQUE with NULL allowed
CREATE TABLE test_unique_nullable (
    id INTEGER PRIMARY KEY,
    optional_email VARCHAR(100) UNIQUE,
    optional_phone VARCHAR(20) UNIQUE
);
