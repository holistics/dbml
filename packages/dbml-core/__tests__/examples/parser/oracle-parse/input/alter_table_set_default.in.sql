-- Oracle SQL ALTER TABLE Set Column Default Test Cases
-- Test setup: Create base tables with minimal required fields
CREATE TABLE customers (
    cust_id NUMBER(10),
    cust_name VARCHAR2(100),
    email VARCHAR2(100),
    phone VARCHAR2(20) DEFAULT '0123456789',
    address VARCHAR2(200),
    status VARCHAR2(20) DEFAULT 'active',
    reg_date DATE,
    last_login TIMESTAMP
);

CREATE TABLE inventory (
    item_id NUMBER(10),
    item_name VARCHAR2(200),
    price NUMBER(10,2),
    category VARCHAR2(50),
    sku VARCHAR2(50),
    weight NUMBER(8,2),
    stock_level NUMBER(10),
    reorder_level NUMBER(10)
);

CREATE TABLE shipments (
    ship_id NUMBER(10),
    customer_id NUMBER(10),
    ship_date DATE,
    total_amount NUMBER(12,2),
    tracking_number VARCHAR2(50),
    carrier VARCHAR2(100),
    priority NUMBER(2),
    notes VARCHAR2(4000)
);

CREATE TABLE departments (
    dept_id NUMBER(10),
    dept_name VARCHAR2(100),
    manager_id NUMBER(10),
    budget NUMBER(12,2),
    location VARCHAR2(50),
    established_date DATE
);

CREATE TABLE suppliers (
    supp_id NUMBER(10),
    supp_name VARCHAR2(100),
    contact VARCHAR2(100),
    ssn VARCHAR2(11),
    badge_number VARCHAR2(10),
    credit_limit NUMBER(10,2)
);

CREATE TABLE test_defaults (
    col1 NUMBER,
    col2 VARCHAR2(50),
    col3 DATE,
    col4 TIMESTAMP,
    col5 CLOB,
    col6 RAW(100),
    col7 FLOAT,
    col8 INTEGER,
    col9 NVARCHAR2(100)
);

-- Create sequence for testing
CREATE SEQUENCE test_seq START WITH 1 INCREMENT BY 1;

-- ============================================
-- BASIC DEFAULT SETTINGS
-- ============================================

-- Simple DEFAULT constraint (numeric literal)
ALTER TABLE customers 
MODIFY cust_id DEFAULT 0;

-- DEFAULT on VARCHAR2 column (string literal)
ALTER TABLE inventory 
MODIFY item_name DEFAULT 'Unknown';

-- DEFAULT on DATE column
ALTER TABLE shipments 
MODIFY ship_date DEFAULT SYSDATE;

-- DEFAULT on NUMBER column
ALTER TABLE departments 
MODIFY budget DEFAULT 10000.00;

-- DEFAULT on CHAR/VARCHAR2 column
ALTER TABLE suppliers 
MODIFY contact DEFAULT 'N/A';

-- ============================================
-- DEFAULT WITH EXPRESSIONS
-- ============================================

-- DEFAULT with SYSDATE
ALTER TABLE customers 
MODIFY reg_date DEFAULT SYSDATE;

-- DEFAULT with USER function
ALTER TABLE inventory 
MODIFY category DEFAULT USER;

-- DEFAULT with SYS_GUID()
ALTER TABLE shipments 
MODIFY tracking_number DEFAULT SYS_GUID();

-- DEFAULT with sequence.NEXTVAL
ALTER TABLE departments 
MODIFY dept_id DEFAULT test_seq.NEXTVAL;

-- DEFAULT with arithmetic expression
ALTER TABLE suppliers 
MODIFY credit_limit DEFAULT 5000 + 1000;

-- ============================================
-- DEFAULT ON NULL
-- ============================================

-- Simple DEFAULT ON NULL (literal)
ALTER TABLE customers 
MODIFY email DEFAULT ON NULL 'noemail@example.com';

-- DEFAULT ON NULL on numeric column
ALTER TABLE inventory 
MODIFY price DEFAULT ON NULL 0.00;

-- DEFAULT ON NULL on date column
ALTER TABLE shipments 
MODIFY customer_id DEFAULT ON NULL 1;

-- DEFAULT ON NULL with expression
ALTER TABLE departments 
MODIFY established_date DEFAULT ON NULL SYSDATE;

-- DEFAULT ON NULL on VARCHAR2
ALTER TABLE suppliers 
MODIFY supp_name DEFAULT ON NULL 'Anonymous';

-- ============================================
-- OVERRIDING DEFAULT
-- ============================================

-- Remove DEFAULT by setting to NULL
ALTER TABLE customers 
MODIFY phone DEFAULT NULL;

-- Overide DEFAULT
ALTER TABLE customers
MODIFY status DEFAULT 'churned';

-- ============================================
-- MULTIPLE COLUMNS IN ONE STATEMENT
-- ============================================

-- Multiple DEFAULT settings in single ALTER
ALTER TABLE customers 
MODIFY (cust_id DEFAULT 1, email DEFAULT 'email@example.com');

-- Multiple with mixed options
ALTER TABLE inventory 
MODIFY (price DEFAULT 0.99 NOT NULL, category DEFAULT 'Misc' NOT NULL);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Very long default string
ALTER TABLE shipments 
MODIFY notes DEFAULT 'This is a very long default value for testing purposes, exceeding typical lengths to check parser limits and storage implications in Oracle SQL';

-- DEFAULT with complex expression
ALTER TABLE departments 
MODIFY location DEFAULT UPPER(USER) || '_DEPT';
