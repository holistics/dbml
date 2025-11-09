-- PostgreSQL Inline Column Default Test Cases

CREATE TABLE customers (
    cust_id INTEGER DEFAULT 0,
    cust_name VARCHAR(100) DEFAULT 'Unknown',
    email VARCHAR(100) DEFAULT 'noemail@example.com',
    phone VARCHAR(20) DEFAULT 'N/A',
    address VARCHAR(200) DEFAULT 'Unknown Address',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    reg_date DATE DEFAULT CURRENT_DATE,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory (
    item_id INTEGER DEFAULT 1,
    item_name VARCHAR(200) DEFAULT 'Item',
    price NUMERIC(10,2) DEFAULT 0.00,
    category VARCHAR(50) DEFAULT 'Misc',
    sku VARCHAR(50) DEFAULT 'SKU000',
    weight NUMERIC(8,2) DEFAULT 0.0,
    stock_level INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10
);

-- ============================================
-- BASIC INLINE DEFAULTS
-- ============================================

-- Simple DEFAULT (numeric literal)
CREATE TABLE test_basic_num (
    id INTEGER DEFAULT 0,
    value INTEGER DEFAULT 100
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
    modified_by VARCHAR(30) DEFAULT SESSION_USER
);

-- DEFAULT with UUID (requires uuid-ossp extension)
CREATE TABLE test_expr_uuid (
    unique_id UUID DEFAULT gen_random_uuid(),
    session_id UUID DEFAULT gen_random_uuid()
);

-- DEFAULT with sequence
CREATE SEQUENCE test_seq START 1;
CREATE TABLE test_expr_seq (
    seq_id INTEGER DEFAULT nextval('test_seq'),
    auto_id INTEGER DEFAULT nextval('test_seq')
);

-- DEFAULT with arithmetic expression
CREATE TABLE test_expr_arith (
    base_value INTEGER DEFAULT 1000,
    calc_value INTEGER DEFAULT 1000 + 500
);

-- ============================================
-- INLINE DEFAULT COMBINED WITH NOT NULL
-- ============================================

-- DEFAULT with NOT NULL
CREATE TABLE test_default_not_null (
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    priority INTEGER DEFAULT 1 NOT NULL
);

-- ============================================
-- INLINE DEFAULT ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes_inline (
    col_int INTEGER DEFAULT 0,
    col_bigint BIGINT DEFAULT 0,
    col_smallint SMALLINT DEFAULT 0,
    col_varchar VARCHAR(100) DEFAULT 'Text',
    col_text TEXT DEFAULT 'Default text',
    col_date DATE DEFAULT CURRENT_DATE,
    col_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    col_timestamptz TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    col_numeric NUMERIC(10,2) DEFAULT 0.00,
    col_real REAL DEFAULT 1.23,
    col_double DOUBLE PRECISION DEFAULT 3.14159,
    col_boolean BOOLEAN DEFAULT TRUE
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- DEFAULT with complex expression
CREATE TABLE test_complex_expr (
    full_name VARCHAR(200) DEFAULT CURRENT_USER || '_USER',
    calc_field INTEGER DEFAULT 100 * 2
);

-- Very long default string
CREATE TABLE test_long_default (
    description TEXT DEFAULT 'This is a very long default value for testing purposes, exceeding typical lengths to check parser limits and storage implications in PostgreSQL',
    comments TEXT DEFAULT 'Another long default string to test maximum lengths and handling in table creation statements'
);

-- DEFAULT with NULL
CREATE TABLE test_null_default (
    optional_field VARCHAR(100) DEFAULT NULL,
    nullable_int INTEGER DEFAULT NULL
);

-- DEFAULT with NOW()
CREATE TABLE test_now (
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEFAULT with LOCALTIMESTAMP
CREATE TABLE test_localtimestamp (
    local_time TIMESTAMP DEFAULT LOCALTIMESTAMP,
    local_time_tz TIMESTAMPTZ DEFAULT LOCALTIMESTAMP
);

-- DEFAULT with boolean expressions
CREATE TABLE test_boolean_default (
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    flag BOOLEAN DEFAULT (1=1)
);

-- DEFAULT with ARRAY
CREATE TABLE test_array_default (
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    numbers INTEGER[] DEFAULT '{1,2,3}'
);

-- DEFAULT with JSON/JSONB
CREATE TABLE test_json_default (
    metadata JSON DEFAULT '{}',
    settings JSONB DEFAULT '{}'::JSONB
);

-- DEFAULT with type casts
CREATE TABLE test_cast_default (
    amount NUMERIC DEFAULT 0::NUMERIC,
    ratio DOUBLE PRECISION DEFAULT 0.0::DOUBLE PRECISION
);
