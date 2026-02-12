-- Test NULL default values in Oracle
CREATE TABLE test_nulls (
  id NUMBER PRIMARY KEY,
  nullable_varchar VARCHAR2(255) DEFAULT NULL,
  nullable_int NUMBER DEFAULT NULL,
  nullable_text CLOB DEFAULT NULL,
  nullable_date DATE DEFAULT NULL,
  nullable_timestamp TIMESTAMP DEFAULT NULL,
  not_null_with_default VARCHAR2(50) DEFAULT 'value' NOT NULL,
  just_nullable VARCHAR2(100)
);
