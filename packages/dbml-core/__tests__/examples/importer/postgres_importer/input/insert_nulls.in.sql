-- Test PostgreSQL importer with NULL values in INSERT statements

CREATE TABLE test_table (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  age INT,
  active BOOLEAN DEFAULT true
);

INSERT INTO test_table (id, name, email, age, active) VALUES (1, 'Alice', 'alice@example.com', 25, true);
INSERT INTO test_table (id, name, email, age, active) VALUES (2, 'Bob', NULL, 30, false);
INSERT INTO test_table (id, name, email, age, active) VALUES (3, NULL, NULL, NULL, NULL);
INSERT INTO test_table VALUES (4, 'Charlie', NULL, NULL, true);
