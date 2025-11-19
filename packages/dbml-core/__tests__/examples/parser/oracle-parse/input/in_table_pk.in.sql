-- Oracle SQL Out-of-Line PRIMARY KEY Constraint Test Cases
-- Test cases covering out-of-line PRIMARY KEY constraints in table definitions, including nameless, named, simple, and composite constraints
-- Each table uses unique columns and constraints to avoid repetition, with constraints applied to different columns across cases

-- ============================================
-- PRIMARY KEY ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes (
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
    col_nchar NCHAR(10),
    CONSTRAINT pk_number PRIMARY KEY (col_number),
    CONSTRAINT pk_varchar2 PRIMARY KEY (col_varchar2),
    CONSTRAINT pk_char PRIMARY KEY (col_char),
    CONSTRAINT pk_date PRIMARY KEY (col_date),
    CONSTRAINT pk_timestamp PRIMARY KEY (col_timestamp),
    CONSTRAINT pk_clob PRIMARY KEY (col_clob),
    CONSTRAINT pk_raw PRIMARY KEY (col_raw),
    CONSTRAINT pk_float PRIMARY KEY (col_float),
    CONSTRAINT pk_integer PRIMARY KEY (col_integer),
    CONSTRAINT pk_nvarchar2 PRIMARY KEY (col_nvarchar2),
    CONSTRAINT pk_nchar PRIMARY KEY (col_nchar)
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Composite PRIMARY KEY with multiple columns
CREATE TABLE order_details (
    order_id NUMBER(10),
    item_id NUMBER(10),
    quantity NUMBER(10),
    order_date DATE,
    CONSTRAINT pk_order_details PRIMARY KEY (order_id, item_id)
);

-- PRIMARY KEY with long constraint name
CREATE TABLE reports (
    report_id NUMBER(10),
    report_name VARCHAR2(100),
    report_date DATE,
    status VARCHAR2(20),
    CONSTRAINT pk_very_long_constraint_name_for_testing_parser_limits PRIMARY KEY (report_id)
);

-- PRIMARY KEY with combined options
CREATE TABLE sales (
    sale_id NUMBER(10),
    sale_date DATE,
    amount NUMBER(12,2),
    CONSTRAINT pk_sale PRIMARY KEY (sale_id) ENABLE VALIDATE RELY
);

-- PRIMARY KEY with DISABLE NOVALIDATE NORELY
CREATE TABLE accounts (
    account_id NUMBER(10),
    account_number VARCHAR2(20),
    balance NUMBER(12,2),
    CONSTRAINT pk_account PRIMARY KEY (account_id) DISABLE NOVALIDATE NORELY
);
