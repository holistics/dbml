-- PostgreSQL In-Table PRIMARY KEY Test Cases

-- ============================================
-- BASIC IN-TABLE PRIMARY KEY
-- ============================================

-- Simple PRIMARY KEY definition
CREATE TABLE test_pk_simple (
    id INTEGER,
    name VARCHAR(100),
    PRIMARY KEY (id)
);

-- PRIMARY KEY with constraint name
CREATE TABLE test_pk_named (
    id INTEGER,
    email VARCHAR(100),
    CONSTRAINT pk_test PRIMARY KEY (id)
);

-- ============================================
-- COMPOSITE PRIMARY KEY
-- ============================================

-- Two-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_2 (
    user_id INTEGER,
    account_id INTEGER,
    balance NUMERIC(12,2),
    PRIMARY KEY (user_id, account_id)
);

-- Three-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_3 (
    country VARCHAR(50),
    state VARCHAR(50),
    city VARCHAR(50),
    population INTEGER,
    PRIMARY KEY (country, state, city)
);

-- Named composite PRIMARY KEY
CREATE TABLE test_pk_composite_named (
    order_id INTEGER,
    item_id INTEGER,
    quantity INTEGER,
    CONSTRAINT pk_order_item PRIMARY KEY (order_id, item_id)
);

-- ============================================
-- PRIMARY KEY WITH SERIAL/IDENTITY
-- ============================================

-- In-table PRIMARY KEY on SERIAL column
CREATE TABLE test_pk_serial_inline (
    id SERIAL,
    data VARCHAR(100),
    PRIMARY KEY (id)
);

-- Named PRIMARY KEY with SERIAL
CREATE TABLE test_pk_serial_named (
    user_id SERIAL,
    username VARCHAR(50),
    CONSTRAINT pk_user PRIMARY KEY (user_id)
);

-- PRIMARY KEY on IDENTITY column
CREATE TABLE test_pk_identity (
    id INTEGER GENERATED ALWAYS AS IDENTITY,
    data TEXT,
    PRIMARY KEY (id)
);

-- ============================================
-- PRIMARY KEY WITH OTHER CONSTRAINTS
-- ============================================

-- PRIMARY KEY with UNIQUE on other column
CREATE TABLE test_pk_with_unique (
    id INTEGER,
    email VARCHAR(100) UNIQUE,
    username VARCHAR(50) UNIQUE,
    PRIMARY KEY (id)
);

-- PRIMARY KEY with FOREIGN KEY
CREATE TABLE departments (
    dept_id INTEGER PRIMARY KEY,
    dept_name VARCHAR(100)
);

CREATE TABLE employees (
    emp_id INTEGER,
    emp_name VARCHAR(100),
    dept_id INTEGER,
    PRIMARY KEY (emp_id),
    CONSTRAINT fk_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- PRIMARY KEY with CHECK constraint
CREATE TABLE test_pk_with_check (
    id INTEGER,
    age INTEGER,
    salary NUMERIC(10,2),
    PRIMARY KEY (id),
    CHECK (age >= 18),
    CHECK (salary > 0)
);

-- ============================================
-- PRIMARY KEY WITH NOT NULL COLUMNS
-- ============================================

-- PRIMARY KEY on NOT NULL column
CREATE TABLE test_pk_not_null (
    id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (id)
);

-- Composite PRIMARY KEY on NOT NULL columns
CREATE TABLE test_pk_composite_not_null (
    key1 INTEGER NOT NULL,
    key2 INTEGER NOT NULL,
    value VARCHAR(100),
    PRIMARY KEY (key1, key2)
);

-- ============================================
-- PRIMARY KEY ON DIFFERENT DATA TYPES
-- ============================================

-- PRIMARY KEY on VARCHAR
CREATE TABLE test_pk_varchar (
    code VARCHAR(20),
    description TEXT,
    PRIMARY KEY (code)
);

-- PRIMARY KEY on UUID
CREATE TABLE test_pk_uuid (
    id UUID,
    data TEXT,
    PRIMARY KEY (id)
);

-- PRIMARY KEY on BIGINT
CREATE TABLE test_pk_bigint (
    transaction_id BIGINT,
    amount NUMERIC(12,2),
    PRIMARY KEY (transaction_id)
);

-- PRIMARY KEY on NUMERIC
CREATE TABLE test_pk_numeric (
    account_number NUMERIC(20,0),
    balance NUMERIC(12,2),
    PRIMARY KEY (account_number)
);

-- Composite PRIMARY KEY with mixed types
CREATE TABLE test_pk_mixed_types (
    id INTEGER,
    code VARCHAR(20),
    date DATE,
    amount NUMERIC(10,2),
    PRIMARY KEY (id, code)
);

-- ============================================
-- PRIMARY KEY WITH INDEX OPTIONS
-- ============================================

-- PRIMARY KEY with USING BTREE (implicit)
CREATE TABLE test_pk_btree (
    id INTEGER,
    name VARCHAR(100),
    PRIMARY KEY (id)
);

-- PRIMARY KEY with USING HASH
CREATE TABLE test_pk_hash (
    id INTEGER,
    data VARCHAR(100),
    PRIMARY KEY (id) USING INDEX TABLESPACE pg_default
);

-- ============================================
-- PRIMARY KEY WITH DEFERRABLE
-- ============================================

-- DEFERRABLE INITIALLY DEFERRED
CREATE TABLE test_pk_deferrable (
    id INTEGER,
    name VARCHAR(100),
    CONSTRAINT pk_defer PRIMARY KEY (id) DEFERRABLE INITIALLY DEFERRED
);

-- DEFERRABLE INITIALLY IMMEDIATE
CREATE TABLE test_pk_deferrable_immediate (
    id INTEGER,
    data TEXT,
    PRIMARY KEY (id) DEFERRABLE INITIALLY IMMEDIATE
);

-- NOT DEFERRABLE
CREATE TABLE test_pk_not_deferrable (
    id INTEGER,
    value VARCHAR(100),
    PRIMARY KEY (id) NOT DEFERRABLE
);

-- ============================================
-- EDGE CASES
-- ============================================

-- PRIMARY KEY with quoted identifiers
CREATE TABLE "test-pk-quoted" (
    "user-id" INTEGER,
    "user-name" VARCHAR(100),
    PRIMARY KEY ("user-id")
);

-- Composite PRIMARY KEY with quoted identifiers
CREATE TABLE "order-items" (
    "order-id" INTEGER,
    "item-id" INTEGER,
    quantity INTEGER,
    CONSTRAINT "pk-order-item" PRIMARY KEY ("order-id", "item-id")
);

-- Schema-qualified table with PRIMARY KEY
CREATE SCHEMA IF NOT EXISTS hr;
CREATE TABLE hr.employees_pk (
    emp_id INTEGER,
    emp_name VARCHAR(100),
    PRIMARY KEY (emp_id)
);

-- Four-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_4 (
    year INTEGER,
    month INTEGER,
    day INTEGER,
    sequence INTEGER,
    data VARCHAR(200),
    PRIMARY KEY (year, month, day, sequence)
);
