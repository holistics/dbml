-- Snowflake Inline Column Default Test Cases

CREATE TABLE customers (
    cust_id NUMBER DEFAULT 0,
    cust_name VARCHAR(100) DEFAULT 'Unknown',
    email VARCHAR(100) DEFAULT 'noemail@example.com',
    phone VARCHAR(20) DEFAULT 'N/A',
    address VARCHAR(200) DEFAULT 'Unknown Address',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    reg_date DATE DEFAULT CURRENT_DATE,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory (
    item_id NUMBER DEFAULT 1,
    item_name VARCHAR(200) DEFAULT 'Item',
    price NUMBER(10,2) DEFAULT 0.00,
    category VARCHAR(50) DEFAULT 'Misc',
    sku VARCHAR(50) DEFAULT 'SKU000',
    weight NUMBER(8,2) DEFAULT 0.0,
    stock_level NUMBER DEFAULT 0,
    reorder_level NUMBER DEFAULT 10
);

-- ============================================
-- BASIC INLINE DEFAULTS
-- ============================================

-- Simple DEFAULT (numeric literal)
CREATE TABLE test_basic_num (
    id NUMBER DEFAULT 0,
    value NUMBER DEFAULT 100
);

-- DEFAULT on VARCHAR (string literal)
CREATE TABLE test_basic_varchar (
    name VARCHAR(100) DEFAULT 'Unknown',
    code VARCHAR(10) DEFAULT 'CODE'
);

-- DEFAULT on DATE
CREATE TABLE test_basic_date (
    event_date DATE DEFAULT CURRENT_DATE,
    end_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INLINE DEFAULT WITH EXPRESSIONS
-- ============================================

-- DEFAULT with CURRENT_DATE
CREATE TABLE test_expr_current_date (
    created_at DATE DEFAULT CURRENT_DATE,
    updated_at DATE DEFAULT CURRENT_DATE
);

-- DEFAULT with CURRENT_USER
CREATE TABLE test_expr_user (
    created_by VARCHAR(30) DEFAULT CURRENT_USER,
    modified_by VARCHAR(30) DEFAULT CURRENT_USER()
);

-- DEFAULT with UUID_STRING()
CREATE TABLE test_expr_uuid (
    unique_id VARCHAR(36) DEFAULT UUID_STRING(),
    session_id VARCHAR(36) DEFAULT UUID_STRING()
);

-- DEFAULT with sequence
CREATE SEQUENCE test_seq START 1 INCREMENT 1;

CREATE TABLE test_expr_seq (
    seq_id NUMBER DEFAULT test_seq.NEXTVAL,
    auto_id NUMBER DEFAULT test_seq.NEXTVAL
);

-- DEFAULT with arithmetic expression
CREATE TABLE test_expr_arith (
    base_value NUMBER DEFAULT 1000,
    calc_value NUMBER DEFAULT (1000 + 500)
);

-- ============================================
-- INLINE DEFAULT COMBINED WITH NOT NULL
-- ============================================

-- DEFAULT with NOT NULL
CREATE TABLE test_default_not_null (
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    priority NUMBER DEFAULT 1 NOT NULL
);

-- ============================================
-- INLINE DEFAULT ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes_inline (
    col_number NUMBER DEFAULT 0,
    col_varchar VARCHAR(100) DEFAULT 'Text',
    col_string STRING DEFAULT 'String text',
    col_date DATE DEFAULT CURRENT_DATE,
    col_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    col_timestamp_ntz TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP,
    col_timestamp_ltz TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP,
    col_float FLOAT DEFAULT 1.23,
    col_double DOUBLE DEFAULT 3.14159,
    col_boolean BOOLEAN DEFAULT TRUE
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- DEFAULT with complex expression
CREATE TABLE test_complex_expr (
    full_name VARCHAR(200) DEFAULT (CURRENT_USER || '_USER'),
    calc_field NUMBER DEFAULT (100 * 2)
);

-- Very long default string
CREATE TABLE test_long_default (
    description VARCHAR DEFAULT 'This is a very long default value for testing purposes, exceeding typical lengths to check parser limits and storage implications in Snowflake',
    comments VARCHAR DEFAULT 'Another long default string to test maximum lengths and handling in table creation statements'
);

-- DEFAULT with NULL
CREATE TABLE test_null_default (
    optional_field VARCHAR(100) DEFAULT NULL,
    nullable_int NUMBER DEFAULT NULL
);

-- DEFAULT with SYSDATE()
CREATE TABLE test_sysdate (
    created_at TIMESTAMP DEFAULT SYSDATE()
);

-- DEFAULT with boolean expressions
CREATE TABLE test_boolean_default (
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- DEFAULT with ARRAY
CREATE TABLE test_array_default (
    tags ARRAY DEFAULT ARRAY_CONSTRUCT()
);

-- DEFAULT with OBJECT
CREATE TABLE test_object_default (
    metadata OBJECT DEFAULT OBJECT_CONSTRUCT()
);

-- DEFAULT with VARIANT
CREATE TABLE test_variant_default (
    data VARIANT DEFAULT NULL
);
