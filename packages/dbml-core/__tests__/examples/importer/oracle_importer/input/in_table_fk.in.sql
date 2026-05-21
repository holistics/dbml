-- Oracle SQL Out-of-Line FOREIGN KEY Constraint Test Cases
-- Test cases covering out-of-line FOREIGN KEY constraints in table definitions, including nameless, named, simple, and complex constraints
-- Each table uses unique columns and constraints to avoid repetition, with constraints applied to different columns across cases
-- ============================================
-- BASIC OUT-OF-LINE FOREIGN KEY CONSTRAINTS
-- ============================================
CREATE TABLE departments (
    dept_id NUMBER(10) PRIMARY KEY
);

CREATE TABLE customers (
    cust_id NUMBER(10) PRIMARY KEY
);

CREATE TABLE employees (
    emp_id NUMBER(10),
    emp_name VARCHAR2(100),
    dept_id NUMBER(10),
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- Named FOREIGN KEY
CREATE TABLE orders (
    order_id NUMBER(10),
    customer_id NUMBER(10),
    order_date DATE,
    CONSTRAINT fk_order_cust FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);

-- FOREIGN KEY with NOT NULL
CREATE TABLE shipments (
    ship_id NUMBER(10),
    customer_id NUMBER(10) NOT NULL,
    ship_date DATE,
    CONSTRAINT fk_ship_cust FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);

-- ============================================
-- COMPLEX OUT-OF-LINE FOREIGN KEY CONSTRAINTS
-- ============================================
CREATE TABLE complex_parent (
    id NUMBER(10),
    code VARCHAR2(20),
    PRIMARY KEY (id, code)
);

CREATE TABLE inventory (
    item_id NUMBER(10) PRIMARY KEY
);

CREATE TABLE complex_child (
    child_id NUMBER(10),
    parent_id NUMBER(10),
    parent_code VARCHAR2(20),
    CONSTRAINT fk_child_complex FOREIGN KEY (parent_id, parent_code) REFERENCES complex_parent(id, code)
);

-- FOREIGN KEY with multiple columns (non-composite parent key)
CREATE TABLE order_details (
    detail_id NUMBER(10),
    order_id NUMBER(10),
    item_id NUMBER(10),
    CONSTRAINT fk_detail_item FOREIGN KEY (item_id) REFERENCES inventory(item_id)
);

-- FOREIGN KEY with ON DELETE CASCADE
CREATE TABLE assignments (
    assignment_id NUMBER(10),
    emp_id NUMBER(10),
    dept_id NUMBER(10),
    CONSTRAINT fk_assign_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE
);

-- FOREIGN KEY with ON DELETE SET NULL
CREATE TABLE project_members (
    member_id NUMBER(10),
    emp_id NUMBER(10),
    dept_id NUMBER(10),
    CONSTRAINT fk_member_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE SET NULL
);

-- ============================================
-- FOREIGN KEY ON DIFFERENT DATA TYPES
-- ============================================
CREATE TABLE test_datatypes (
    col_number NUMBER(10,2) UNIQUE,
    col_varchar2 VARCHAR2(100) UNIQUE
);

CREATE TABLE test_datatypes_fk (
    id NUMBER(10),
    col_number NUMBER(10,2),
    col_varchar2 VARCHAR2(100),
    col_char CHAR(10),
    col_date DATE,
    CONSTRAINT fk_dt_number FOREIGN KEY (col_number) REFERENCES test_datatypes(col_number),
    CONSTRAINT fk_dt_varchar2 FOREIGN KEY (col_varchar2) REFERENCES test_datatypes(col_varchar2)
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================
-- FOREIGN KEY with self-referencing table
CREATE TABLE employees_self (
    emp_id NUMBER(10) PRIMARY KEY,
    manager_id NUMBER(10),
    emp_name VARCHAR2(100),
    CONSTRAINT fk_self_manager FOREIGN KEY (manager_id) REFERENCES employees_self(emp_id)
);

-- FOREIGN KEY with long constraint name
CREATE TABLE order_history (
    history_id NUMBER(10),
    order_id NUMBER(10),
    history_date DATE,
    CONSTRAINT fk_very_long_constraint_name_for_testing_parser_limits FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- Complex FOREIGN KEY with ON DELETE CASCADE and DEFERRABLE
CREATE TABLE shipment_details (
    detail_id NUMBER(10),
    ship_id NUMBER(10),
    item_id NUMBER(10),
    CONSTRAINT fk_ship_detail FOREIGN KEY (ship_id) REFERENCES shipments(ship_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

-- FOREIGN KEY with combined options (ENABLE VALIDATE RELY)
CREATE TABLE project_assignments (
    assign_id NUMBER(10),
    emp_id NUMBER(10),
    project_id NUMBER(10),
    CONSTRAINT fk_assign_emp FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ENABLE VALIDATE RELY
);
