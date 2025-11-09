-- MSSQL Data Types Test Cases

-- ============================================
-- INTEGER TYPES
-- ============================================

CREATE TABLE test_integer_types (
    col_tinyint TINYINT,
    col_smallint SMALLINT,
    col_int INT,
    col_bigint BIGINT
);

-- Integer types with IDENTITY
CREATE TABLE test_identity_types (
    col_identity_int INT IDENTITY(1,1),
    col_identity_bigint BIGINT IDENTITY(1,1),
    col_identity_seed INT IDENTITY(100,10)
);

-- ============================================
-- DECIMAL AND NUMERIC TYPES
-- ============================================

CREATE TABLE test_decimal_types (
    col_decimal DECIMAL(10,2),
    col_numeric NUMERIC(10,2),
    col_money MONEY,
    col_smallmoney SMALLMONEY
);

-- Decimal with different precisions
CREATE TABLE test_decimal_precision (
    col_decimal_small DECIMAL(5,2),
    col_decimal_medium DECIMAL(10,4),
    col_decimal_large DECIMAL(20,8),
    col_decimal_max DECIMAL(38,10)
);

-- ============================================
-- FLOATING POINT TYPES
-- ============================================

CREATE TABLE test_float_types (
    col_float FLOAT,
    col_float_precision FLOAT(24),
    col_real REAL
);

-- ============================================
-- BIT TYPE
-- ============================================

CREATE TABLE test_bit_type (
    col_bit BIT,
    is_active BIT,
    is_deleted BIT
);

-- ============================================
-- CHARACTER TYPES
-- ============================================

CREATE TABLE test_char_types (
    col_char CHAR(10),
    col_varchar VARCHAR(255),
    col_varchar_max VARCHAR(MAX),
    col_nchar NCHAR(10),
    col_nvarchar NVARCHAR(255),
    col_nvarchar_max NVARCHAR(MAX)
);

-- Character types with different lengths
CREATE TABLE test_char_lengths (
    col_char_1 CHAR(1),
    col_varchar_100 VARCHAR(100),
    col_nvarchar_4000 NVARCHAR(4000),
    col_varchar_max VARCHAR(MAX)
);

-- ============================================
-- TEXT TYPES (deprecated but still used)
-- ============================================

CREATE TABLE test_text_types (
    col_text TEXT,
    col_ntext NTEXT
);

-- ============================================
-- BINARY TYPES
-- ============================================

CREATE TABLE test_binary_types (
    col_binary BINARY(10),
    col_varbinary VARBINARY(255),
    col_varbinary_max VARBINARY(MAX),
    col_image IMAGE
);

-- ============================================
-- DATE AND TIME TYPES
-- ============================================

CREATE TABLE test_datetime_types (
    col_date DATE,
    col_time TIME,
    col_datetime DATETIME,
    col_datetime2 DATETIME2,
    col_smalldatetime SMALLDATETIME,
    col_datetimeoffset DATETIMEOFFSET
);

-- DateTime with precision
CREATE TABLE test_datetime_precision (
    col_time_3 TIME(3),
    col_time_7 TIME(7),
    col_datetime2_3 DATETIME2(3),
    col_datetime2_7 DATETIME2(7),
    col_datetimeoffset_3 DATETIMEOFFSET(3)
);

-- ============================================
-- UNIQUEIDENTIFIER TYPE
-- ============================================

CREATE TABLE test_uniqueidentifier (
    col_guid UNIQUEIDENTIFIER,
    col_guid_default UNIQUEIDENTIFIER DEFAULT NEWID()
);

-- ============================================
-- XML TYPE
-- ============================================

CREATE TABLE test_xml_type (
    col_xml XML
);

-- ============================================
-- SQL_VARIANT TYPE
-- ============================================

CREATE TABLE test_sql_variant (
    col_variant SQL_VARIANT
);

-- ============================================
-- HIERARCHYID TYPE
-- ============================================

CREATE TABLE test_hierarchyid (
    col_hierarchy HIERARCHYID
);

-- ============================================
-- GEOMETRY AND GEOGRAPHY TYPES
-- ============================================

CREATE TABLE test_spatial_types (
    col_geometry GEOMETRY,
    col_geography GEOGRAPHY
);

-- ============================================
-- COMPUTED COLUMNS
-- ============================================

CREATE TABLE test_computed_columns (
    quantity INT,
    price DECIMAL(10,2),
    total AS (quantity * price),
    total_persisted AS (quantity * price) PERSISTED
);

-- ============================================
-- ROWVERSION/TIMESTAMP
-- ============================================

CREATE TABLE test_rowversion (
    id INT PRIMARY KEY,
    data NVARCHAR(100),
    row_version ROWVERSION
);

CREATE TABLE test_timestamp (
    id INT PRIMARY KEY,
    info NVARCHAR(200),
    ts TIMESTAMP
);

-- ============================================
-- COMPREHENSIVE DATA TYPES TABLE
-- ============================================

CREATE TABLE test_all_types (
    -- Integer types
    col_tinyint TINYINT,
    col_smallint SMALLINT,
    col_int INT,
    col_bigint BIGINT,

    -- Decimal types
    col_decimal DECIMAL(10,2),
    col_numeric NUMERIC(10,2),
    col_money MONEY,
    col_smallmoney SMALLMONEY,

    -- Floating point
    col_float FLOAT,
    col_real REAL,

    -- Bit
    col_bit BIT,

    -- Character types
    col_char CHAR(50),
    col_varchar VARCHAR(255),
    col_nchar NCHAR(50),
    col_nvarchar NVARCHAR(255),
    col_nvarchar_max NVARCHAR(MAX),

    -- Binary types
    col_binary BINARY(10),
    col_varbinary VARBINARY(MAX),

    -- Date and time types
    col_date DATE,
    col_time TIME,
    col_datetime DATETIME,
    col_datetime2 DATETIME2,
    col_datetimeoffset DATETIMEOFFSET,

    -- Other types
    col_uniqueidentifier UNIQUEIDENTIFIER,
    col_xml XML,
    col_rowversion ROWVERSION
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Maximum sizes
CREATE TABLE test_max_sizes (
    col_varchar_max VARCHAR(MAX),
    col_nvarchar_max NVARCHAR(MAX),
    col_varbinary_max VARBINARY(MAX),
    col_decimal_max DECIMAL(38,10)
);

-- Minimum sizes
CREATE TABLE test_min_sizes (
    col_char_min CHAR(1),
    col_varchar_min VARCHAR(1),
    col_nvarchar_min NVARCHAR(1),
    col_decimal_min DECIMAL(1,0)
);
