CREATE TABLE test_integers (
  id integer PRIMARY KEY,
  decimal_col integer DEFAULT 42,
  binary_col integer DEFAULT 0b101010,
  octal_col integer DEFAULT 0o52,
  hex_col integer DEFAULT 0x2A,
  zero_leading_col integer DEFAULT 012345
);
