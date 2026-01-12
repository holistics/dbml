-- Oracle SQL Out-of-Line CHECK Constraint Test Cases
-- Test cases covering out-of-line CHECK constraints in table definitions, including nameless, named, simple, and complex constraints
-- Each table uses unique columns and constraints to avoid repetition, with constraints applied to different columns across cases

-- ============================================
-- BASIC OUT-OF-LINE CHECK CONSTRAINTS
-- ============================================

-- Simple nameless CHECK constraint
CREATE TABLE customers (
    cust_id NUMBER(10),
    cust_name VARCHAR2(100),
    email VARCHAR2(100),
    phone VARCHAR2(20),
    CHECK (cust_id > 0)
);

-- Named CHECK constraint
CREATE TABLE inventory (
    item_id NUMBER(10),
    item_name VARCHAR2(200),
    price NUMBER(10,2),
    category VARCHAR2(50),
    CONSTRAINT chk_price_pos CHECK (price >= 0)
);

-- Out-of-line CHECK with multiple columns
CREATE TABLE shipments (
    ship_id NUMBER(10),
    customer_id NUMBER(10),
    ship_date DATE,
    total_amount NUMBER(12,2),
    CONSTRAINT chk_amount_date CHECK (total_amount >= 0 AND ship_date IS NOT NULL)
);

-- ============================================
-- SIMPLE OUT-OF-LINE CHECK CONSTRAINTS
-- ============================================

-- Nameless CHECK on single column
CREATE TABLE departments (
    dept_id NUMBER(10),
    dept_name VARCHAR2(100),
    manager_id NUMBER(10),
    budget NUMBER(12,2),
    CHECK (budget >= 0)
);

-- Named CHECK on single column
CREATE TABLE suppliers (
    supp_id NUMBER(10),
    supp_name VARCHAR2(100),
    contact VARCHAR2(100),
    credit_limit NUMBER(10,2),
    CONSTRAINT chk_credit_limit CHECK (credit_limit >= 0)
);

-- CHECK with string pattern
CREATE TABLE employees (
    emp_id NUMBER(10),
    emp_name VARCHAR2(100),
    email VARCHAR2(100),
    status VARCHAR2(20),
    CONSTRAINT chk_status_values CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);

-- ============================================
-- COMPLEX OUT-OF-LINE CHECK CONSTRAINTS
-- ============================================

-- Complex CHECK with multiple conditions
CREATE TABLE orders (
    order_id NUMBER(10),
    customer_id NUMBER(10),
    order_date DATE,
    total_amount NUMBER(12,2),
    tax_amount NUMBER(10,2),
    CONSTRAINT chk_order_amounts CHECK (total_amount >= tax_amount AND tax_amount >= 0)
);

-- Complex CHECK with date comparison
CREATE TABLE contracts (
    contract_id NUMBER(10),
    start_date DATE,
    end_date DATE,
    amount NUMBER(12,2),
    CONSTRAINT chk_date_range CHECK (end_date > start_date AND start_date >= SYSDATE)
);

-- Complex CHECK with pattern matching
CREATE TABLE users (
    user_id NUMBER(10),
    username VARCHAR2(50),
    email VARCHAR2(100),
    ssn VARCHAR2(11),
    CONSTRAINT chk_ssn_format CHECK (ssn LIKE '[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]')
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Complex CHECK with multiple columns and expressions
CREATE TABLE sales (
    sale_id NUMBER(10),
    sale_date DATE,
    amount NUMBER(12,2),
    discount NUMBER(10,2),
    CONSTRAINT chk_sale_complex CHECK (amount >= discount AND discount >= 0 AND sale_date >= SYSDATE)
);

-- CHECK with regular expression
CREATE TABLE accounts (
    account_id NUMBER(10),
    account_number VARCHAR2(20),
    balance NUMBER(12,2),
    account_type VARCHAR2(20),
    CONSTRAINT chk_acc_number CHECK (REGEXP_LIKE(account_number, '^[0-9]{10}$'))
);

-- CHECK with long constraint name
CREATE TABLE reports (
    report_id NUMBER(10),
    report_name VARCHAR2(100),
    report_date DATE,
    status VARCHAR2(20),
    CONSTRAINT chk_very_long_constraint_name_for_testing_parser_limits CHECK (status IN ('DRAFT', 'FINAL', 'ARCHIVED'))
);

-- CHECK with subquery (Note: Oracle allows subqueries in CHECK constraints in some versions)
CREATE TABLE employees_sub (
    emp_id NUMBER(10),
    dept_id NUMBER(10),
    emp_name VARCHAR2(100),
    salary NUMBER(10,2),
    CONSTRAINT chk_dept_exists CHECK (dept_id IN (SELECT dept_id FROM departments))
);
