-- Snowflake In-Table PRIMARY KEY Test Cases

-- ============================================
-- BASIC IN-TABLE PRIMARY KEY
-- ============================================

-- Simple PRIMARY KEY definition
CREATE TABLE test_pk_simple (
    id NUMBER,
    name VARCHAR(100),
    PRIMARY KEY (id)
);

-- PRIMARY KEY with constraint name
CREATE TABLE test_pk_named (
    id NUMBER,
    email VARCHAR(100),
    CONSTRAINT pk_test PRIMARY KEY (id)
);

-- ============================================
-- COMPOSITE PRIMARY KEY
-- ============================================

-- Two-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_2 (
    user_id NUMBER,
    account_id NUMBER,
    balance NUMBER(12,2),
    PRIMARY KEY (user_id, account_id)
);

-- Three-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_3 (
    country VARCHAR(50),
    state VARCHAR(50),
    city VARCHAR(50),
    population NUMBER,
    PRIMARY KEY (country, state, city)
);

-- Named composite PRIMARY KEY
CREATE TABLE test_pk_composite_named (
    order_id NUMBER,
    item_id NUMBER,
    quantity NUMBER,
    CONSTRAINT pk_order_item PRIMARY KEY (order_id, item_id)
);

-- ============================================
-- PRIMARY KEY WITH AUTOINCREMENT/IDENTITY
-- ============================================

-- In-table PRIMARY KEY on AUTOINCREMENT column
CREATE TABLE test_pk_auto_inline (
    id NUMBER AUTOINCREMENT,
    data VARCHAR(100),
    PRIMARY KEY (id)
);

-- Named PRIMARY KEY with IDENTITY
CREATE TABLE test_pk_identity_named (
    user_id NUMBER IDENTITY,
    username VARCHAR(50),
    CONSTRAINT pk_user PRIMARY KEY (user_id)
);

-- ============================================
-- PRIMARY KEY WITH OTHER CONSTRAINTS
-- ============================================

-- PRIMARY KEY with UNIQUE on other column
CREATE TABLE test_pk_with_unique (
    id NUMBER,
    email VARCHAR(100) UNIQUE,
    username VARCHAR(50) UNIQUE,
    PRIMARY KEY (id)
);

-- PRIMARY KEY with FOREIGN KEY
CREATE TABLE departments (
    dept_id NUMBER PRIMARY KEY,
    dept_name VARCHAR(100)
);

CREATE TABLE employees (
    emp_id NUMBER,
    emp_name VARCHAR(100),
    dept_id NUMBER,
    PRIMARY KEY (emp_id),
    CONSTRAINT fk_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- PRIMARY KEY with CHECK constraint
CREATE TABLE test_pk_with_check (
    id NUMBER,
    age NUMBER,
    salary NUMBER(10,2),
    PRIMARY KEY (id),
    CHECK (age >= 18),
    CHECK (salary > 0)
);

-- ============================================
-- PRIMARY KEY ON DIFFERENT DATA TYPES
-- ============================================

-- PRIMARY KEY on VARCHAR
CREATE TABLE test_pk_varchar (
    code VARCHAR(20),
    description VARCHAR,
    PRIMARY KEY (code)
);

-- PRIMARY KEY on STRING
CREATE TABLE test_pk_string (
    id STRING,
    data VARCHAR,
    PRIMARY KEY (id)
);

-- PRIMARY KEY on DATE
CREATE TABLE test_pk_date (
    event_date DATE,
    event_name VARCHAR(100),
    PRIMARY KEY (event_date)
);

-- Composite PRIMARY KEY with mixed types
CREATE TABLE test_pk_mixed_types (
    id NUMBER,
    code VARCHAR(20),
    date DATE,
    amount NUMBER(10,2),
    PRIMARY KEY (id, code)
);

-- ============================================
-- EDGE CASES
-- ============================================

-- PRIMARY KEY with quoted identifiers
CREATE TABLE "test-pk-quoted" (
    "user-id" NUMBER,
    "user-name" VARCHAR(100),
    PRIMARY KEY ("user-id")
);

-- Composite PRIMARY KEY with quoted identifiers
CREATE TABLE "order-items" (
    "order-id" NUMBER,
    "item-id" NUMBER,
    quantity NUMBER,
    CONSTRAINT "pk-order-item" PRIMARY KEY ("order-id", "item-id")
);

-- Schema-qualified table with PRIMARY KEY
CREATE SCHEMA test_schema;

CREATE TABLE test_schema.test_pk_schema (
    emp_id NUMBER,
    emp_name VARCHAR(100),
    PRIMARY KEY (emp_id)
);

-- Four-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_4 (
    year NUMBER,
    month NUMBER,
    day NUMBER,
    sequence NUMBER,
    data VARCHAR(200),
    PRIMARY KEY (year, month, day, sequence)
);
