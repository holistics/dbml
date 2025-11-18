-- Oracle SQL Inline Foreign Key Constraint Test Cases
-- Test setup: Create parent tables first, followed by child tables with inline FOREIGN KEY constraints
CREATE TABLE departments (
    dept_id NUMBER(10),
    dept_name VARCHAR2(100),
    CONSTRAINT pk_dept_id PRIMARY KEY (dept_id)
);

CREATE TABLE suppliers (
    supp_id NUMBER(10),
    supp_name VARCHAR2(100),
    CONSTRAINT pk_supp_id PRIMARY KEY (supp_id)
);

CREATE TABLE customers (
    cust_id NUMBER(10),
    cust_name VARCHAR2(100),
    CONSTRAINT pk_cust_id PRIMARY KEY (cust_id)
);

CREATE TABLE inventory (
    item_id NUMBER(10),
    item_name VARCHAR2(200),
    CONSTRAINT pk_item_id PRIMARY KEY (item_id)
);

CREATE TABLE complex_test (
    id NUMBER(10),
    code VARCHAR2(20),
    CONSTRAINT pk_complex_id PRIMARY KEY (id)
);

CREATE TABLE test_datatypes (
    col_number NUMBER(10,2),
    col_varchar2 VARCHAR2(100),
    CONSTRAINT pk_datatype_number PRIMARY KEY (col_number)
);

-- Create sequence for testing
CREATE SEQUENCE test_seq START WITH 1 INCREMENT BY 1;

-- ============================================
-- BASIC INLINE FOREIGN KEY CONSTRAINTS
-- ============================================

-- Simple inline FOREIGN KEY
CREATE TABLE employees (
    emp_id NUMBER(10),
    emp_name VARCHAR2(100),
    dept_id NUMBER(10) CONSTRAINT fk_emp_dept REFERENCES departments(dept_id),
    manager_id NUMBER(10) CONSTRAINT fk_emp_manager REFERENCES employees(emp_id)
);

-- FOREIGN KEY on VARCHAR2 column
CREATE TABLE orders (
    order_id NUMBER(10),
    customer_id NUMBER(10) CONSTRAINT fk_order_cust REFERENCES customers(cust_id),
    tracking_number VARCHAR2(50) CONSTRAINT fk_order_track REFERENCES shipments(tracking_number)
);

-- FOREIGN KEY with NOT NULL
CREATE TABLE shipments (
    ship_id NUMBER(10),
    customer_id NUMBER(10) NOT NULL CONSTRAINT fk_ship_cust REFERENCES customers(cust_id),
    tracking_number VARCHAR2(50) CONSTRAINT pk_ship_track PRIMARY KEY
);

-- FOREIGN KEY referencing composite key
CREATE TABLE complex_child (
    child_id NUMBER(10),
    parent_id NUMBER(10) CONSTRAINT fk_child_complex REFERENCES complex_test(id),
    parent_code VARCHAR2(20) CONSTRAINT fk_child_code REFERENCES complex_test(code)
);

-- ============================================
-- FOREIGN KEY WITH ENABLE/DISABLE
-- ============================================

-- FOREIGN KEY with ENABLE
CREATE TABLE test_enable (
    id NUMBER(10),
    dept_id NUMBER(10) CONSTRAINT fk_enable_dept REFERENCES departments(dept_id) ENABLE,
    supp_id NUMBER(10) CONSTRAINT fk_enable_supp REFERENCES suppliers(supp_id) ENABLE
);

-- FOREIGN KEY with DISABLE
CREATE TABLE test_disable (
    id NUMBER(10),
    dept_id NUMBER(10) CONSTRAINT fk_disable_dept REFERENCES departments(dept_id) DISABLE,
    cust_id NUMBER(10) CONSTRAINT fk_disable_cust REFERENCES customers(cust_id) DISABLE
);

-- FOREIGN KEY with ENABLE VALIDATE
CREATE TABLE test_validate (
    id NUMBER(10),
    item_id NUMBER(10) CONSTRAINT fk_validate_item REFERENCES inventory(item_id) ENABLE VALIDATE,
    supp_id NUMBER(10) CONSTRAINT fk_validate_supp REFERENCES suppliers(supp_id) ENABLE VALIDATE
);

-- FOREIGN KEY with ENABLE NOVALIDATE
CREATE TABLE test_novalidate (
    id NUMBER(10),
    dept_id NUMBER(10) CONSTRAINT fk_noval_dept REFERENCES departments(dept_id) ENABLE NOVALIDATE,
    cust_id NUMBER(10) CONSTRAINT fk_noval_cust REFERENCES customers(cust_id) ENABLE NOVALIDATE
);

-- FOREIGN KEY with DISABLE NOVALIDATE
CREATE TABLE test_disable_novalidate (
    id NUMBER(10),
    item_id NUMBER(10) CONSTRAINT fk_dis_noval_item REFERENCES inventory(item_id) DISABLE NOVALIDATE,
    supp_id NUMBER(10) CONSTRAINT fk_dis_noval_supp REFERENCES suppliers(supp_id) DISABLE NOVALIDATE
);

-- ============================================
-- FOREIGN KEY WITH RELY/NORELY
-- ============================================

-- FOREIGN KEY with RELY
CREATE TABLE test_rely (
    id NUMBER(10),
    dept_id NUMBER(10) CONSTRAINT fk_rely_dept REFERENCES departments(dept_id) RELY,
    cust_id NUMBER(10) CONSTRAINT fk_rely_cust REFERENCES customers(cust_id) RELY
);

-- FOREIGN KEY with NORELY
CREATE TABLE test_norely (
    id NUMBER(10),
    item_id NUMBER(10) CONSTRAINT fk_norely_item REFERENCES inventory(item_id) NORELY,
    supp_id NUMBER(10) CONSTRAINT fk_norely_supp REFERENCES suppliers(supp_id) NORELY
);

-- FOREIGN KEY with ENABLE RELY
CREATE TABLE test_enable_rely (
    id NUMBER(10),
    dept_id NUMBER(10) CONSTRAINT fk_en_rely_dept REFERENCES departments(dept_id) ENABLE RELY,
    cust_id NUMBER(10) CONSTRAINT fk_en_rely_cust REFERENCES customers(cust_id) ENABLE RELY
);

-- FOREIGN KEY with DISABLE NORELY
CREATE TABLE test_disable_norely (
    id NUMBER(10),
    item_id NUMBER(10) CONSTRAINT fk_dis_norely_item REFERENCES inventory(item_id) DISABLE NORELY,
    supp_id NUMBER(10) CONSTRAINT fk_dis_norely_supp REFERENCES suppliers(supp_id) DISABLE NORELY
);

-- ============================================
-- FOREIGN KEY WITH DEFERRABLE OPTIONS
-- ============================================

-- FOREIGN KEY with DEFERRABLE INITIALLY DEFERRED
CREATE TABLE test_deferrable_deferred (
    id NUMBER(10),
    dept_id NUMBER(10) CONSTRAINT fk_def_deferred_dept REFERENCES departments(dept_id) DEFERRABLE INITIALLY DEFERRED,
    cust_id NUMBER(10) CONSTRAINT fk_def_deferred_cust REFERENCES customers(cust_id) DEFERRABLE INITIALLY DEFERRED
);

-- FOREIGN KEY with DEFERRABLE INITIALLY IMMEDIATE
CREATE TABLE test_deferrable_immediate (
    id NUMBER(10),
    item_id NUMBER(10) CONSTRAINT fk_def_immed_item REFERENCES inventory(item_id) DEFERRABLE INITIALLY IMMEDIATE,
    supp_id NUMBER(10) CONSTRAINT fk_def_immed_supp REFERENCES suppliers(supp_id) DEFERRABLE INITIALLY IMMEDIATE
);

-- FOREIGN KEY with NOT DEFERRABLE
CREATE TABLE test_not_deferrable (
    id NUMBER(10),
    dept_id NUMBER(10) CONSTRAINT fk_not_def_dept REFERENCES departments(dept_id) NOT DEFERRABLE,
    cust_id NUMBER(10) CONSTRAINT fk_not_def_cust REFERENCES customers(cust_id) NOT DEFERRABLE
);

-- ============================================
-- FOREIGN KEY ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes_fk (
    id NUMBER(10),
    col_number NUMBER(10,2) CONSTRAINT fk_dt_number REFERENCES test_datatypes(col_number),
    col_varchar2 VARCHAR2(100) CONSTRAINT fk_dt_varchar2 REFERENCES test_datatypes(col_varchar2),
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
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- FOREIGN KEY with self-referencing table
CREATE TABLE employees_self (
    emp_id NUMBER(10),
    manager_id NUMBER(10) CONSTRAINT fk_self_emp REFERENCES employees_self(emp_id),
    dept_id NUMBER(10) CONSTRAINT fk_self_dept REFERENCES departments(dept_id)
);

-- FOREIGN KEY with composite key reference
CREATE TABLE order_details (
    order_id NUMBER(10),
    item_id NUMBER(10) CONSTRAINT fk_detail_item REFERENCES inventory(item_id),
    cust_id NUMBER(10) CONSTRAINT fk_detail_cust REFERENCES customers(cust_id)
);

-- FOREIGN KEY with ON DELETE CASCADE
CREATE TABLE test_cascade (
    id NUMBER(10),
    dept_id NUMBER(10) CONSTRAINT fk_cascade_dept REFERENCES departments(dept_id) ON DELETE CASCADE,
    supp_id NUMBER(10) CONSTRAINT fk_cascade_supp REFERENCES suppliers(supp_id) ON DELETE CASCADE
);

-- FOREIGN KEY with ON DELETE SET NULL
CREATE TABLE test_set_null (
    id NUMBER(10),
    dept_id NUMBER(10) CONSTRAINT fk_set_null_dept REFERENCES departments(dept_id) ON DELETE SET NULL,
    cust_id NUMBER(10) CONSTRAINT fk_set_null_cust REFERENCES customers(cust_id) ON DELETE SET NULL
);
