-- Simple insert with columns
INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com');

-- Bulk insert
INSERT INTO users (id, name, email) VALUES
  (2, 'Bob', 'bob@example.com'),
  (3, 'Charlie', 'charlie@example.com');

-- Insert into schema.table
INSERT INTO test_schema.products (product_id, product_name, price) VALUES (100, 'Widget', 9.99);
