CREATE TABLE "edge_cases" (
  "id" integer PRIMARY KEY,
  "scientific_notation_pos" float,
  "scientific_notation_neg" float,
  "signed_positive" integer,
  "signed_negative" integer,
  "sql_function_default" varchar,
  "dbml_expr_default" integer,
  "datetime_value" timestamp,
  "string_with_newline" text,
  "string_with_backslash" varchar,
  "string_with_escape_seq" varchar,
  "string_with_quotes" varchar,
  "null_value" varchar
);

-- Disable constraint checking for INSERT
BEGIN;
SET session_replication_role = replica;

INSERT INTO "edge_cases" ("id", "scientific_notation_pos", "scientific_notation_neg", "signed_positive", "signed_negative", "sql_function_default", "dbml_expr_default", "datetime_value", "string_with_newline", "string_with_backslash", "string_with_escape_seq", "string_with_quotes", "null_value")
VALUES
  (1, 123000, -0.00456, 42, -100, NOW(), 1 + 2 * 3, '2024-01-15T10:30:00.123+07:00', 'Line 1
Line 2
Line 3', 'C:\Users\path\file.txt', 'Tab:	Newline:
Carriage return:', 'She said "Hello" and ''Hi''', NULL),
  (2, 99900000000, -1.11e-10, 0, 0, CURRENT_TIMESTAMP, LENGTH('test'), '2023-12-31T23:59:59+07:00', 'First line

Third line', 'Escaped backslash: \\', 'Quote: " Apostrophe: '' Backslash: \', 'O''Reilly''s "book"', NULL);

SET session_replication_role = DEFAULT;
COMMIT;
