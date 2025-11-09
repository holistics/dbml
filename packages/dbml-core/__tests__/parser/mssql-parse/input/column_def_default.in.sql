-- MSSQL Inline Column Default Test Cases

CREATE TABLE customers (
    cust_id INT DEFAULT 0,
    cust_name NVARCHAR(100) DEFAULT 'Unknown',
    email NVARCHAR(100) DEFAULT 'noemail@example.com',
    phone NVARCHAR(20) DEFAULT 'N/A',
    address NVARCHAR(200) DEFAULT 'Unknown Address',
    status NVARCHAR(20) DEFAULT 'ACTIVE',
    reg_date DATE DEFAULT GETDATE(),
    last_login DATETIME DEFAULT GETDATE()
);

CREATE TABLE inventory (
    item_id INT DEFAULT 1,
    item_name NVARCHAR(200) DEFAULT 'Item',
    price DECIMAL(10,2) DEFAULT 0.00,
    category NVARCHAR(50) DEFAULT 'Misc',
    sku NVARCHAR(50) DEFAULT 'SKU000',
    weight DECIMAL(8,2) DEFAULT 0.0,
    stock_level INT DEFAULT 0,
    reorder_level INT DEFAULT 10
);

-- ============================================
-- BASIC INLINE DEFAULTS
-- ============================================

-- Simple DEFAULT (numeric literal)
CREATE TABLE test_basic_num (
    id INT DEFAULT 0,
    value INT DEFAULT 100
);

-- DEFAULT on NVARCHAR (string literal)
CREATE TABLE test_basic_varchar (
    name NVARCHAR(100) DEFAULT 'Unknown',
    code NVARCHAR(10) DEFAULT 'CODE'
);

-- DEFAULT on DATE
CREATE TABLE test_basic_date (
    event_date DATE DEFAULT GETDATE(),
    end_date DATETIME DEFAULT GETDATE()
);

-- ============================================
-- INLINE DEFAULT WITH EXPRESSIONS
-- ============================================

-- DEFAULT with GETDATE()
CREATE TABLE test_expr_getdate (
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- DEFAULT with CURRENT_TIMESTAMP
CREATE TABLE test_expr_current_timestamp (
    timestamp_col DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DEFAULT with SUSER_NAME()
CREATE TABLE test_expr_user (
    created_by NVARCHAR(30) DEFAULT SUSER_NAME(),
    modified_by NVARCHAR(30) DEFAULT USER_NAME()
);

-- DEFAULT with NEWID()
CREATE TABLE test_expr_newid (
    unique_id UNIQUEIDENTIFIER DEFAULT NEWID(),
    session_id UNIQUEIDENTIFIER DEFAULT NEWID()
);

-- DEFAULT with arithmetic expression
CREATE TABLE test_expr_arith (
    base_value INT DEFAULT 1000,
    calc_value INT DEFAULT (1000 + 500)
);

-- ============================================
-- INLINE DEFAULT COMBINED WITH NOT NULL
-- ============================================

-- DEFAULT with NOT NULL
CREATE TABLE test_default_not_null (
    status NVARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    priority INT DEFAULT 1 NOT NULL
);

-- ============================================
-- INLINE DEFAULT ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes_inline (
    col_int INT DEFAULT 0,
    col_bigint BIGINT DEFAULT 0,
    col_smallint SMALLINT DEFAULT 0,
    col_tinyint TINYINT DEFAULT 0,
    col_nvarchar NVARCHAR(100) DEFAULT 'Text',
    col_varchar VARCHAR(100) DEFAULT 'Text',
    col_ntext NVARCHAR(MAX) DEFAULT 'Default text',
    col_date DATE DEFAULT GETDATE(),
    col_datetime DATETIME DEFAULT GETDATE(),
    col_datetime2 DATETIME2 DEFAULT SYSDATETIME(),
    col_decimal DECIMAL(10,2) DEFAULT 0.00,
    col_money MONEY DEFAULT 0.00,
    col_float FLOAT DEFAULT 1.23,
    col_real REAL DEFAULT 3.14,
    col_bit BIT DEFAULT 1
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- DEFAULT with complex expression
CREATE TABLE test_complex_expr (
    full_name NVARCHAR(200) DEFAULT (SUSER_NAME() + '_USER'),
    calc_field INT DEFAULT (100 * 2)
);

-- Very long default string
CREATE TABLE test_long_default (
    description NVARCHAR(MAX) DEFAULT 'This is a very long default value for testing purposes, exceeding typical lengths to check parser limits and storage implications in MSSQL',
    comments NVARCHAR(MAX) DEFAULT 'Another long default string to test maximum lengths and handling in table creation statements'
);

-- DEFAULT with NULL
CREATE TABLE test_null_default (
    optional_field NVARCHAR(100) DEFAULT NULL,
    nullable_int INT DEFAULT NULL
);

-- DEFAULT with SYSDATETIME()
CREATE TABLE test_sysdatetime (
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    timestamp_col DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);

-- DEFAULT with GETUTCDATE()
CREATE TABLE test_getutcdate (
    utc_time DATETIME DEFAULT GETUTCDATE()
);

-- DEFAULT with CAST
CREATE TABLE test_cast_default (
    amount DECIMAL DEFAULT CAST(0 AS DECIMAL),
    ratio FLOAT DEFAULT CAST(0.0 AS FLOAT)
);

-- DEFAULT with CONSTRAINT name
CREATE TABLE test_named_default (
    status NVARCHAR(20) CONSTRAINT df_status DEFAULT 'active',
    priority INT CONSTRAINT df_priority DEFAULT 1
);

-- DEFAULT with boolean-like values
CREATE TABLE test_bit_default (
    is_active BIT DEFAULT 1,
    is_deleted BIT DEFAULT 0
);
