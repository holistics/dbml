-- Test INSERT with NULL values in MySQL
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  age INT
);

INSERT INTO users (id, name, email, age) VALUES (1, 'Alice', 'alice@example.com', 25);
INSERT INTO users (id, name, email, age) VALUES (2, 'Bob', NULL, 30);
INSERT INTO users (id, name, email, age) VALUES (3, NULL, NULL, NULL);
INSERT INTO users VALUES (4, 'Charlie', NULL, NULL);
