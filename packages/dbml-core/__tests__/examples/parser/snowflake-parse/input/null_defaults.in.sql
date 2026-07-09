-- Test NULL default values in Snowflake
CREATE TABLE test_nulls (
  id INT PRIMARY KEY,
  nullable_varchar VARCHAR(255) DEFAULT NULL,
  nullable_int INT DEFAULT NULL,
  nullable_text TEXT DEFAULT NULL,
  nullable_date DATE DEFAULT NULL,
  nullable_timestamp TIMESTAMP DEFAULT NULL,
  not_null_with_default VARCHAR(50) NOT NULL DEFAULT 'value',
  just_nullable VARCHAR(100)
);
