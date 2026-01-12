CREATE TABLE customers (
  name VARCHAR(20)
);

COMMENT ON TABLE customers IS 'This table stores customer data.';
COMMENT ON COLUMN customers.name IS 'The name of the customer.';
