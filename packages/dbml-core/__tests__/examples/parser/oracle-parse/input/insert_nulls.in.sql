-- Test INSERT with NULL values in Oracle
CREATE TABLE users (
  id NUMBER PRIMARY KEY,
  name VARCHAR2(100),
  email VARCHAR2(100),
  age NUMBER
);

INSERT INTO users (id, name, email, age) VALUES (1, 'Alice', 'alice@example.com', 25);
INSERT INTO users (id, name, email, age) VALUES (2, 'Bob', NULL, 30);
INSERT INTO users (id, name, email, age) VALUES (3, NULL, NULL, NULL);
INSERT INTO users VALUES (4, 'Charlie', NULL, NULL);
