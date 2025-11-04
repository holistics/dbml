-- Oracle SQL ALTER TABLE ADD NOT NULL Constraint Test Cases
-- Test setup: Create base tables with minimal required fields
CREATE TABLE customers (
    cust_id NUMBER(10),
    cust_name VARCHAR2(100),
    email VARCHAR2(100),
    phone VARCHAR2(20)
);

CREATE TABLE inventory (
    item_id NUMBER(10),
    item_name VARCHAR2(200),
    price NUMBER(10,2),
    category VARCHAR2(50),
    manufacturer VARCHAR2(100),
    sku VARCHAR2(50)
);

CREATE TABLE shipments (
    ship_id NUMBER(10),
    customer_id NUMBER(10),
    ship_date DATE,
    total_amount NUMBER(12,2)
);

CREATE TABLE departments (
    dept_id NUMBER(10),
    dept_name VARCHAR2(100),
    manager_id NUMBER(10),
    status VARCHAR2(20)
);

CREATE TABLE suppliers (
    supp_id NUMBER(10),
    supp_name VARCHAR2(100),
    contact VARCHAR2(100),
    ssn VARCHAR2(11),
    badge_number VARCHAR2(10)
);

-- ============================================
-- BASIC NOT NULL CONSTRAINTS
-- ============================================

-- Simple NOT NULL constraint (Oracle 11g+ inline syntax)
-- Note: In Oracle, NOT NULL is technically a CHECK constraint
ALTER TABLE customers 
MODIFY cust_name NOT NULL;

-- NOT NULL on numeric column
ALTER TABLE inventory 
MODIFY price NOT NULL;

-- NOT NULL on date column
ALTER TABLE shipments 
MODIFY ship_date NOT NULL;

-- NOT NULL on VARCHAR2 column
ALTER TABLE customers 
MODIFY email NOT NULL;

-- NOT NULL on CHAR column
ALTER TABLE inventory 
MODIFY category NOT NULL;

-- ============================================
-- NAMED NOT NULL CONSTRAINTS
-- ============================================

-- NOT NULL with explicit constraint name
ALTER TABLE departments 
MODIFY dept_name CONSTRAINT nn_dept_name NOT NULL;

-- Multiple named NOT NULL constraints
ALTER TABLE shipments 
MODIFY customer_id CONSTRAINT nn_ship_customer NOT NULL;

ALTER TABLE suppliers 
MODIFY supp_name CONSTRAINT nn_supp_name NOT NULL;

-- Named NOT NULL on different data types
ALTER TABLE inventory 
MODIFY item_name CONSTRAINT nn_item_name NOT NULL;

ALTER TABLE shipments 
MODIFY total_amount CONSTRAINT nn_ship_total NOT NULL;

ALTER TABLE departments 
MODIFY dept_id CONSTRAINT nn_dept_id NOT NULL;

-- Multiple NOT NULL constraints
ALTER TABLE inventory 
MODIFY (manufacturer NOT NULL, sku NOT NULL);
