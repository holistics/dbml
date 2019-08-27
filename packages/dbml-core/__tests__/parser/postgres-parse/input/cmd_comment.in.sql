CREATE TABLE my_table (
  my_column varchar
);

COMMENT ON TABLE my_table IS 'This is my table.';

COMMENT ON TABLE my_table IS NULL;

COMMENT ON COLUMN my_table.my_column IS 'Employee ID number';