-- Oracle SQL ALTER TABLE Add Check Constraint Test Cases
-- Test setup: Create tables without CHECK constraints
CREATE TABLE customers (
    cust_id NUMBER(10),
    cust_name VARCHAR2(100) NOT NULL,
    email VARCHAR2(100),
    phone VARCHAR2(20),
    address VARCHAR2(200)
);

CREATE TABLE inventory (
    item_id NUMBER(10),
    item_name VARCHAR2(200) NOT NULL,
    price NUMBER(10,2) NOT NULL,
    category VARCHAR2(50),
    sku VARCHAR2(50)
);

CREATE TABLE shipments (
    ship_id NUMBER(10),
    customer_id NUMBER(10) NOT NULL,
    ship_date DATE,
    total_amount NUMBER(12,2),
    tracking_number VARCHAR2(50)
);

CREATE TABLE datatype_tests (
    col_number NUMBER(10,2),
    col_varchar2 VARCHAR2(100),
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

CREATE TABLE complex_test (
    id NUMBER(10),
    code VARCHAR2(20),
    name VARCHAR2(100) NOT NULL,
    parent_id NUMBER(10),
    status VARCHAR2(20),
    CONSTRAINT fk_complex_parent FOREIGN KEY (parent_id) REFERENCES complex_test(id)
);

CREATE TABLE combo_test (
    col1 NUMBER(10),
    col2 VARCHAR2(50)
);

-- ============================================
-- ADD CHECK CONSTRAINTS (All Methods)
-- ============================================

-- Method 1: Add CHECK constraint with named constraint (single condition)
ALTER TABLE customers 
ADD CONSTRAINT chk_cust_id_pos CHECK (cust_id > 0);

-- Method 2: Add CHECK constraint without constraint name
ALTER TABLE inventory 
ADD CHECK (price >= 0);

-- Method 3: Add CHECK constraint with multiple conditions (compound expression)
ALTER TABLE shipments 
ADD CONSTRAINT chk_ship_amount CHECK (total_amount >= 0);

-- Method 4: Add CHECK constraint on VARCHAR2 with specific values
ALTER TABLE inventory 
ADD CONSTRAINT chk_inv_category CHECK (category IN ('ELECTRONICS', 'CLOTHING', 'BOOKS'));

-- Method 5: Add CHECK constraint with date comparison
ALTER TABLE shipments 
ADD CONSTRAINT chk_ship_date_valid CHECK (ship_date >= TRUNC(SYSDATE));

-- Method 6: Add CHECK constraint with complex expression (multiple columns)
ALTER TABLE complex_test 
ADD CONSTRAINT chk_id_status CHECK (id IS NOT NULL OR status = 'ACTIVE');
