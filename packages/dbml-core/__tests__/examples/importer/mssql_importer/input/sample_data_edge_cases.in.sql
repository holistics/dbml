-- Test edge cases for data types: scientific notation in defaults, signed numbers, datetime
CREATE TABLE [sample_data_test] (
  [id] int,
  [scientific_num] decimal(20,10) DEFAULT 1.23e-5,
  [signed_positive] int DEFAULT +42,
  [signed_negative] int DEFAULT -99,
  [sql_func_default] datetime DEFAULT (GETDATE()),
  [datetime_val] datetime DEFAULT '2024-01-15 10:30:00',
  [string_simple] nvarchar(200) DEFAULT 'test value',
  [computed_expr] AS ([id] + 10) PERSISTED
)
GO
