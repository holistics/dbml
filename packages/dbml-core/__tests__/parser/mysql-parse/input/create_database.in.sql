-- Test CREATE DATABASE/SCHEMA with various options and edge cases

-- Simple database creation
CREATE DATABASE simple_db;

-- Database with IF NOT EXISTS
CREATE DATABASE IF NOT EXISTS conditional_db;

-- Database with CHARACTER SET
CREATE DATABASE charset_db CHARACTER SET utf8mb4;

-- Database with CHARSET (alias)
CREATE DATABASE charset_alias_db CHARSET utf8mb4;

-- Database with COLLATE
CREATE DATABASE collate_db COLLATE utf8mb4_unicode_ci;

-- Database with both CHARACTER SET and COLLATE
CREATE DATABASE full_charset_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- Database with DEFAULT keyword
CREATE DATABASE default_charset_db
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_general_ci;

-- CREATE SCHEMA (synonym for DATABASE)
CREATE SCHEMA simple_schema;

-- SCHEMA with IF NOT EXISTS
CREATE SCHEMA IF NOT EXISTS conditional_schema;

-- SCHEMA with CHARACTER SET
CREATE SCHEMA charset_schema CHARACTER SET latin1;

-- SCHEMA with COLLATE
CREATE SCHEMA collate_schema COLLATE latin1_swedish_ci;

-- SCHEMA with both options
CREATE SCHEMA full_schema
CHARACTER SET utf8
COLLATE utf8_general_ci;

-- Edge case: Database name with backticks
CREATE DATABASE `database-with-dashes`;

-- Edge case: Database name with numbers
CREATE DATABASE db2023;

-- Edge case: Database name starting with number (needs quotes)
CREATE DATABASE `123database`;

-- Edge case: Reserved word as database name (quoted)
CREATE DATABASE `select`;

-- Edge case: Database with underscores
CREATE DATABASE my_app_db;

-- Database with utf8mb3
CREATE DATABASE utf8mb3_db CHARACTER SET utf8mb3;

-- Database with ascii charset
CREATE DATABASE ascii_db CHARACTER SET ascii;

-- Database with binary collation
CREATE DATABASE binary_db COLLATE utf8mb4_bin;

-- Database with case-sensitive collation
CREATE DATABASE case_sensitive_db COLLATE utf8mb4_0900_as_cs;

-- Database with accent-insensitive collation
CREATE DATABASE accent_insensitive_db COLLATE utf8mb4_0900_ai_ci;

-- Edge case: Very long database name (64 chars is max)
CREATE DATABASE very_long_database_name_that_is_almost_at_the_maximum_length_x;

-- Edge case: Single character database name
CREATE DATABASE a;

-- Edge case: Database name with only numbers (quoted)
CREATE DATABASE `12345`;

-- Database with greek charset
CREATE DATABASE greek_db CHARACTER SET greek COLLATE greek_general_ci;

-- Database with hebrew charset
CREATE DATABASE hebrew_db CHARACTER SET hebrew COLLATE hebrew_general_ci;

-- Database with cp1251 (Cyrillic)
CREATE DATABASE cyrillic_db CHARACTER SET cp1251 COLLATE cp1251_general_ci;

-- Database with sjis (Japanese)
CREATE DATABASE japanese_db CHARACTER SET sjis COLLATE sjis_japanese_ci;

-- Database with gbk (Chinese)
CREATE DATABASE chinese_db CHARACTER SET gbk COLLATE gbk_chinese_ci;

-- ALTER DATABASE - change default charset
ALTER DATABASE simple_db CHARACTER SET utf8mb4;

-- ALTER DATABASE - change collation
ALTER DATABASE simple_db COLLATE utf8mb4_unicode_ci;

-- ALTER DATABASE - change both
ALTER DATABASE simple_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- ALTER DATABASE with DEFAULT keyword
ALTER DATABASE simple_db
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_general_ci;

-- ALTER SCHEMA (synonym)
ALTER SCHEMA simple_schema CHARACTER SET utf8mb4;

-- ALTER SCHEMA with both options
ALTER SCHEMA simple_schema
CHARACTER SET latin1
COLLATE latin1_swedish_ci;

-- Edge case: ALTER DATABASE with backticks
ALTER DATABASE `database-with-dashes` CHARACTER SET utf8mb4;

-- Edge case: ALTER DATABASE with reserved word name
ALTER DATABASE `select` COLLATE utf8mb4_bin;

-- Multiple databases created in sequence
CREATE DATABASE app_db CHARACTER SET utf8mb4;
CREATE DATABASE test_db CHARACTER SET utf8mb4;
CREATE DATABASE staging_db CHARACTER SET utf8mb4;
CREATE DATABASE production_db CHARACTER SET utf8mb4;

-- Databases with various collations
CREATE DATABASE ci_db COLLATE utf8mb4_general_ci;
CREATE DATABASE cs_db COLLATE utf8mb4_0900_as_cs;
CREATE DATABASE bin_db COLLATE utf8mb4_bin;

-- Edge case: Database with special characters in name (quoted)
CREATE DATABASE `db@test`;
CREATE DATABASE `db#special`;
CREATE DATABASE `db.with.dots`;

-- Edge case: Database name matching MySQL keywords
CREATE DATABASE `database`;
CREATE DATABASE `table`;
CREATE DATABASE `index`;
CREATE DATABASE `procedure`;
CREATE DATABASE `function`;

-- Database with utf16 charset
CREATE DATABASE utf16_db CHARACTER SET utf16 COLLATE utf16_general_ci;

-- Database with utf32 charset
CREATE DATABASE utf32_db CHARACTER SET utf32 COLLATE utf32_general_ci;

-- Edge case: IF NOT EXISTS with other options
CREATE DATABASE IF NOT EXISTS complex_conditional_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- Edge case: Schema with IF NOT EXISTS and options
CREATE SCHEMA IF NOT EXISTS complex_conditional_schema
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_general_ci;
