-- MySQL Data Types Test Cases

-- ============================================
-- INTEGER TYPES
-- ============================================

CREATE TABLE test_integer_types (
    col_tinyint TINYINT,
    col_smallint SMALLINT,
    col_mediumint MEDIUMINT,
    col_int INT,
    col_integer INTEGER,
    col_bigint BIGINT
);

-- Integer types with UNSIGNED
CREATE TABLE test_integer_unsigned (
    col_tinyint_unsigned TINYINT UNSIGNED,
    col_smallint_unsigned SMALLINT UNSIGNED,
    col_mediumint_unsigned MEDIUMINT UNSIGNED,
    col_int_unsigned INT UNSIGNED,
    col_bigint_unsigned BIGINT UNSIGNED
);

-- Integer types with ZEROFILL
CREATE TABLE test_integer_zerofill (
    col_int_zerofill INT ZEROFILL,
    col_int_unsigned_zerofill INT UNSIGNED ZEROFILL
);

-- Integer types with width
CREATE TABLE test_integer_width (
    col_int_w INT(10),
    col_tinyint_w TINYINT(3),
    col_bigint_w BIGINT(20)
);

-- ============================================
-- DECIMAL TYPES
-- ============================================

CREATE TABLE test_decimal_types (
    col_decimal DECIMAL(10,2),
    col_dec DEC(10,2),
    col_numeric NUMERIC(10,2),
    col_fixed FIXED(10,2)
);

-- Decimal with different precisions
CREATE TABLE test_decimal_precision (
    col_decimal_small DECIMAL(5,2),
    col_decimal_medium DECIMAL(10,4),
    col_decimal_large DECIMAL(20,8),
    col_decimal_max DECIMAL(65,30)
);

-- ============================================
-- FLOATING POINT TYPES
-- ============================================

CREATE TABLE test_float_types (
    col_float FLOAT,
    col_double DOUBLE,
    col_double_precision DOUBLE PRECISION,
    col_real REAL
);

-- Float with precision
CREATE TABLE test_float_precision (
    col_float_p FLOAT(7,4),
    col_double_p DOUBLE(15,8)
);

-- ============================================
-- BIT TYPE
-- ============================================

CREATE TABLE test_bit_type (
    col_bit BIT,
    col_bit_1 BIT(1),
    col_bit_8 BIT(8),
    col_bit_64 BIT(64)
);

-- ============================================
-- STRING TYPES
-- ============================================

CREATE TABLE test_string_types (
    col_char CHAR(10),
    col_varchar VARCHAR(255),
    col_binary BINARY(10),
    col_varbinary VARBINARY(255)
);

-- String types with different character sets
CREATE TABLE test_string_charset (
    col_varchar_utf8 VARCHAR(100) CHARACTER SET utf8mb4,
    col_char_latin1 CHAR(50) CHARACTER SET latin1,
    col_text_utf8 TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
);

-- ============================================
-- TEXT TYPES
-- ============================================

CREATE TABLE test_text_types (
    col_tinytext TINYTEXT,
    col_text TEXT,
    col_mediumtext MEDIUMTEXT,
    col_longtext LONGTEXT
);

-- ============================================
-- BLOB TYPES
-- ============================================

CREATE TABLE test_blob_types (
    col_tinyblob TINYBLOB,
    col_blob BLOB,
    col_mediumblob MEDIUMBLOB,
    col_longblob LONGBLOB
);

-- ============================================
-- DATE AND TIME TYPES
-- ============================================

CREATE TABLE test_datetime_types (
    col_date DATE,
    col_datetime DATETIME,
    col_timestamp TIMESTAMP,
    col_time TIME,
    col_year YEAR
);

-- DateTime with precision
CREATE TABLE test_datetime_precision (
    col_datetime_3 DATETIME(3),
    col_datetime_6 DATETIME(6),
    col_timestamp_3 TIMESTAMP(3),
    col_timestamp_6 TIMESTAMP(6),
    col_time_3 TIME(3)
);

-- ============================================
-- ENUM AND SET TYPES
-- ============================================

CREATE TABLE test_enum_set (
    col_enum ENUM('small', 'medium', 'large'),
    col_set SET('read', 'write', 'execute')
);

-- Enum with many values
CREATE TABLE test_enum_many (
    col_status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'archived')
);

-- Set with many values
CREATE TABLE test_set_many (
    col_permissions SET('create', 'read', 'update', 'delete', 'admin', 'superuser')
);

-- ============================================
-- JSON TYPE
-- ============================================

CREATE TABLE test_json_type (
    col_json JSON
);

-- ============================================
-- SPATIAL TYPES
-- ============================================

CREATE TABLE test_spatial_types (
    col_geometry GEOMETRY,
    col_point POINT,
    col_linestring LINESTRING,
    col_polygon POLYGON,
    col_multipoint MULTIPOINT,
    col_multilinestring MULTILINESTRING,
    col_multipolygon MULTIPOLYGON,
    col_geometrycollection GEOMETRYCOLLECTION
);

-- Spatial types with SRID
CREATE TABLE test_spatial_srid (
    col_point_srid POINT SRID 4326,
    col_geometry_srid GEOMETRY SRID 4326
);

-- ============================================
-- BOOLEAN TYPE
-- ============================================

CREATE TABLE test_boolean (
    col_bool BOOL,
    col_boolean BOOLEAN
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
    col_int_unsigned INT UNSIGNED,

    -- Decimal types
    col_decimal DECIMAL(10,2),
    col_float FLOAT,
    col_double DOUBLE,

    -- String types
    col_char CHAR(50),
    col_varchar VARCHAR(255),
    col_text TEXT,
    col_longtext LONGTEXT,

    -- Binary types
    col_binary BINARY(10),
    col_varbinary VARBINARY(100),
    col_blob BLOB,

    -- Date and time types
    col_date DATE,
    col_datetime DATETIME,
    col_timestamp TIMESTAMP,
    col_time TIME,
    col_year YEAR,

    -- Other types
    col_enum ENUM('a', 'b', 'c'),
    col_set SET('x', 'y', 'z'),
    col_json JSON,
    col_boolean BOOLEAN,
    col_bit BIT(8)
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Maximum sizes
CREATE TABLE test_max_sizes (
    col_varchar_max VARCHAR(65535),
    col_decimal_max DECIMAL(65,30)
);

-- Minimum sizes
CREATE TABLE test_min_sizes (
    col_char_min CHAR(1),
    col_varchar_min VARCHAR(1),
    col_decimal_min DECIMAL(1,0)
);
