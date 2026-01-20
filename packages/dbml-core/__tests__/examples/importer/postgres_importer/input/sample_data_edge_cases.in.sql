-- Test edge cases for data types: scientific notation in defaults, signed numbers, datetime
CREATE TABLE "sample_data_test" (
  "id" int,
  "scientific_num" decimal(20,10) DEFAULT 1.23e-5,
  "signed_positive" int DEFAULT +42,
  "signed_negative" int DEFAULT -99,
  "sql_func_default" timestamp DEFAULT NOW(),
  "datetime_val" timestamp DEFAULT '2024-01-15 10:30:00',
  "string_simple" varchar(200) DEFAULT 'test value',
  "computed_expr" int GENERATED ALWAYS AS ("id" + 10) STORED
);
