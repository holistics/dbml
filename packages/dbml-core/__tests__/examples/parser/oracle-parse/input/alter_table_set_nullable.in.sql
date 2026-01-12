-- Oracle SQL ALTER TABLE Set Nullable (Remove NOT NULL) Test Cases
-- Test setup: Create tables with NOT NULL constraints
CREATE TABLE employees (
    emp_id NUMBER(10) CONSTRAINT nn_emp_id NOT NULL,
    emp_name VARCHAR2(100) NOT NULL,
    email VARCHAR2(100) CONSTRAINT nn_emp_email NOT NULL,
    phone VARCHAR2(20) NOT NULL,
    salary NUMBER(10,2) NOT NULL,
    commission_pct NUMBER(3,2) NOT NULL,
    hire_date DATE NOT NULL,
    department_id NUMBER(10) NOT NULL,
    manager_id NUMBER(10) CONSTRAINT nn_emp_manager NOT NULL,
    status VARCHAR2(20) NOT NULL,
    ssn VARCHAR2(11) CONSTRAINT nn_emp_ssn NOT NULL,
    badge_number VARCHAR2(10) NOT NULL,
    title VARCHAR2(100) NOT NULL,
    office_location VARCHAR2(50) NOT NULL
);

CREATE TABLE products (
    product_id NUMBER(10) NOT NULL,
    product_name VARCHAR2(200) CONSTRAINT nn_prod_name NOT NULL,
    description VARCHAR2(4000) NOT NULL,
    price NUMBER(10,2) CONSTRAINT nn_prod_price NOT NULL,
    category VARCHAR2(50) NOT NULL,
    manufacturer VARCHAR2(100) CONSTRAINT nn_prod_manuf NOT NULL,
    sku VARCHAR2(50) NOT NULL,
    weight NUMBER(8,2) NOT NULL
);

CREATE TABLE orders (
    order_id NUMBER(10) NOT NULL,
    customer_id NUMBER(10) CONSTRAINT nn_order_customer NOT NULL,
    order_date DATE NOT NULL,
    ship_date DATE CONSTRAINT nn_order_ship NOT NULL,
    total_amount NUMBER(12,2) NOT NULL,
    tax_amount NUMBER(10,2) NOT NULL,
    discount_amount NUMBER(10,2) NOT NULL
);

-- ============================================
-- BASIC NULL SYNTAX (Make Column Nullable)
-- ============================================

-- Simple MODIFY to NULL (removes NOT NULL constraint)
ALTER TABLE employees 
MODIFY commission_pct NULL;

-- Make numeric column nullable
ALTER TABLE employees 
MODIFY salary NULL;

-- Make VARCHAR2 column nullable
ALTER TABLE employees 
MODIFY phone NULL;

-- Make DATE column nullable
ALTER TABLE employees 
MODIFY hire_date NULL;

-- Make multiple columns nullable (separate statements)
ALTER TABLE products 
MODIFY description NULL;

ALTER TABLE products 
MODIFY weight NULL;

ALTER TABLE products 
MODIFY manufacturer NULL;

-- ============================================
-- MODIFY COLUMN TO NULL (Various Data Types)
-- ============================================

CREATE TABLE datatype_tests (
    col_number NUMBER(10,2) NOT NULL,
    col_varchar2 VARCHAR2(100) NOT NULL,
    col_char CHAR(10) NOT NULL,
    col_date DATE NOT NULL,
    col_timestamp TIMESTAMP NOT NULL,
    col_clob CLOB NOT NULL,
    col_raw RAW(100) NOT NULL,
    col_float FLOAT NOT NULL,
    col_integer INTEGER NOT NULL,
    col_nvarchar2 NVARCHAR2(100) NOT NULL,
    col_nchar NCHAR(10) NOT NULL
);

-- Make NUMBER column nullable
ALTER TABLE datatype_tests 
MODIFY col_number NULL;

-- Make VARCHAR2 column nullable
ALTER TABLE datatype_tests 
MODIFY col_varchar2 NULL;

-- Make CHAR column nullable
ALTER TABLE datatype_tests 
MODIFY col_char NULL;

-- Make DATE column nullable
ALTER TABLE datatype_tests 
MODIFY col_date NULL;

-- Make TIMESTAMP column nullable
ALTER TABLE datatype_tests 
MODIFY col_timestamp NULL;

-- Make CLOB column nullable
ALTER TABLE datatype_tests 
MODIFY col_clob NULL;

-- Make RAW column nullable
ALTER TABLE datatype_tests 
MODIFY col_raw NULL;

-- Make FLOAT column nullable
ALTER TABLE datatype_tests 
MODIFY col_float NULL;

-- Make INTEGER column nullable
ALTER TABLE datatype_tests 
MODIFY col_integer NULL;

-- Make NVARCHAR2 column nullable
ALTER TABLE datatype_tests 
MODIFY col_nvarchar2 NULL;

-- Make NCHAR column nullable
ALTER TABLE datatype_tests 
MODIFY col_nchar NULL;

-- ============================================
-- COMPLEX SCENARIOS
-- ============================================

-- Table with multiple constraint types
CREATE TABLE complex_test (
    id NUMBER(10) CONSTRAINT pk_complex PRIMARY KEY,
    code VARCHAR2(20) CONSTRAINT uk_complex_code UNIQUE NOT NULL,
    name VARCHAR2(100) CONSTRAINT nn_complex_name NOT NULL,
    parent_id NUMBER(10) CONSTRAINT nn_complex_parent NOT NULL,
    status VARCHAR2(20) CONSTRAINT nn_complex_status NOT NULL,
    CONSTRAINT fk_complex_parent FOREIGN KEY (parent_id) REFERENCES complex_test(id)
);

-- Make column nullable using MODIFY
ALTER TABLE complex_test 
MODIFY status NULL;

ALTER TABLE complex_test 
MODIFY code NULL;

-- ============================================
-- COMBINATION WITH OTHER MODIFICATIONS
-- ============================================

CREATE TABLE combo_test (
    col1 NUMBER(10) NOT NULL,
    col2 VARCHAR2(50) NOT NULL
);

-- Modify data type and make nullable in same statement
ALTER TABLE combo_test 
MODIFY col1 NUMBER(12) NULL;

-- Modify size and make nullable
ALTER TABLE combo_test 
MODIFY col2 VARCHAR2(100) NULL;
