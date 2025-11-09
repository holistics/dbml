-- Snowflake Data Types Test Cases

-- ============================================
-- NUMERIC TYPES
-- ============================================

CREATE TABLE test_numeric_types (
    col_number NUMBER,
    col_number_precision NUMBER(10,2),
    col_decimal DECIMAL(10,2),
    col_numeric NUMERIC(10,2),
    col_int INT,
    col_integer INTEGER,
    col_bigint BIGINT,
    col_smallint SMALLINT,
    col_tinyint TINYINT,
    col_byteint BYTEINT
);

-- Number with different precisions
CREATE TABLE test_number_precision (
    col_number_small NUMBER(5,2),
    col_number_medium NUMBER(10,4),
    col_number_large NUMBER(20,8),
    col_number_max NUMBER(38,10)
);

-- ============================================
-- FLOATING POINT TYPES
-- ============================================

CREATE TABLE test_float_types (
    col_float FLOAT,
    col_float4 FLOAT4,
    col_float8 FLOAT8,
    col_double DOUBLE,
    col_double_precision DOUBLE PRECISION,
    col_real REAL
);

-- ============================================
-- STRING AND TEXT TYPES
-- ============================================

CREATE TABLE test_string_types (
    col_varchar VARCHAR(255),
    col_varchar_max VARCHAR,
    col_char CHAR(10),
    col_character CHARACTER(10),
    col_string STRING,
    col_text TEXT
);

-- String types with different lengths
CREATE TABLE test_string_lengths (
    col_varchar_100 VARCHAR(100),
    col_varchar_16mb VARCHAR(16777216),
    col_char_1 CHAR(1)
);

-- ============================================
-- BINARY TYPES
-- ============================================

CREATE TABLE test_binary_types (
    col_binary BINARY,
    col_varbinary VARBINARY,
    col_binary_sized BINARY(100)
);

-- ============================================
-- BOOLEAN TYPE
-- ============================================

CREATE TABLE test_boolean (
    col_boolean BOOLEAN,
    is_active BOOLEAN,
    is_deleted BOOLEAN
);

-- ============================================
-- DATE AND TIME TYPES
-- ============================================

CREATE TABLE test_datetime_types (
    col_date DATE,
    col_datetime DATETIME,
    col_time TIME,
    col_timestamp TIMESTAMP,
    col_timestamp_ntz TIMESTAMP_NTZ,
    col_timestamp_ltz TIMESTAMP_LTZ,
    col_timestamp_tz TIMESTAMP_TZ
);

-- DateTime with precision
CREATE TABLE test_datetime_precision (
    col_timestamp_0 TIMESTAMP(0),
    col_timestamp_3 TIMESTAMP(3),
    col_timestamp_6 TIMESTAMP(6),
    col_timestamp_9 TIMESTAMP(9),
    col_time_3 TIME(3)
);

-- ============================================
-- SEMI-STRUCTURED TYPES
-- ============================================

CREATE TABLE test_semistructured_types (
    col_variant VARIANT,
    col_object OBJECT,
    col_array ARRAY
);

-- ============================================
-- GEOGRAPHY AND GEOMETRY TYPES
-- ============================================

CREATE TABLE test_spatial_types (
    col_geography GEOGRAPHY,
    col_geometry GEOMETRY
);

-- ============================================
-- AUTOINCREMENT/IDENTITY
-- ============================================

CREATE TABLE test_autoincrement (
    col_auto NUMBER AUTOINCREMENT,
    col_identity NUMBER IDENTITY,
    col_identity_options NUMBER IDENTITY(1000,10)
);

-- ============================================
-- COMPREHENSIVE DATA TYPES TABLE
-- ============================================

CREATE TABLE test_all_types (
    -- Numeric types
    col_number NUMBER,
    col_decimal DECIMAL(10,2),
    col_int INT,
    col_bigint BIGINT,
    col_smallint SMALLINT,

    -- Floating point
    col_float FLOAT,
    col_double DOUBLE,
    col_real REAL,

    -- String types
    col_varchar VARCHAR(255),
    col_string STRING,
    col_text TEXT,
    col_char CHAR(50),

    -- Binary types
    col_binary BINARY,
    col_varbinary VARBINARY,

    -- Boolean
    col_boolean BOOLEAN,

    -- Date and time types
    col_date DATE,
    col_time TIME,
    col_timestamp TIMESTAMP,
    col_timestamp_ntz TIMESTAMP_NTZ,
    col_timestamp_ltz TIMESTAMP_LTZ,
    col_timestamp_tz TIMESTAMP_TZ,

    -- Semi-structured types
    col_variant VARIANT,
    col_object OBJECT,
    col_array ARRAY,

    -- Spatial types
    col_geography GEOGRAPHY,
    col_geometry GEOMETRY
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Maximum sizes
CREATE TABLE test_max_sizes (
    col_varchar_max VARCHAR(16777216),
    col_number_max NUMBER(38,10)
);

-- Minimum sizes
CREATE TABLE test_min_sizes (
    col_varchar_min VARCHAR(1),
    col_char_min CHAR(1),
    col_number_min NUMBER(1,0)
);

-- Default NUMBER (without precision/scale)
CREATE TABLE test_number_default (
    col_number_no_precision NUMBER
);
