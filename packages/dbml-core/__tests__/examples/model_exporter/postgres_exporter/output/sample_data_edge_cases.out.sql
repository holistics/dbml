CREATE TABLE "sample_data_test" (
  "id" int,
  "scientific_num" decimal(20,10),
  "signed_positive" int,
  "signed_negative" int,
  "sql_func" datetime,
  "datetime_val" datetime,
  "string_newline" varchar(200),
  "string_backslash" varchar(200),
  "string_escape" varchar(200),
  "dbml_expr" int
);

-- Disable constraint checking for INSERT
BEGIN;
SET session_replication_role = replica;

INSERT INTO "sample_data_test" ("id", "scientific_num", "signed_positive", "signed_negative", "sql_func", "datetime_val", "string_newline", "string_backslash", "string_escape", "dbml_expr")
VALUES
  (1, 1.23e-5, +42, -99, NOW(), '2024-01-15 10:30:00', 'line1\nline2\nline3', 'path\\to\\file', 'tab\there\nquote\''end', "id" + 10),
  (2, -3.14E+2, +0, -0, CURRENT_TIMESTAMP(), '2024-12-31 23:59:59', 'multi\nline\ntext\nhere', 'C:\\Users\\test', 'quote\"double', "id" * 2),
  (3, 6.022e23, +123, -456, UTC_TIMESTAMP(), '2024-06-15 12:00:00', 'simple text', 'double\\\\backslash', 'mixed\ttab\nand\rnewline', "scientific_num" / 100);

SET session_replication_role = DEFAULT;
COMMIT;