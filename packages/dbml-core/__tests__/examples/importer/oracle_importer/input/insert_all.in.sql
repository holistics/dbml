-- Test INSERT ALL statement in Oracle importer

CREATE TABLE products (
  id NUMBER PRIMARY KEY,
  name VARCHAR2(100) NOT NULL,
  category VARCHAR2(50),
  price NUMBER(10, 2)
);

CREATE TABLE suppliers (
  id NUMBER PRIMARY KEY,
  name VARCHAR2(100) NOT NULL,
  country VARCHAR2(50)
);

-- Test 1: INSERT ALL with same table - should group into one record
INSERT ALL
  INTO products (id, name, category, price) VALUES (1, 'Laptop', 'Electronics', 999.99)
  INTO products (id, name, category, price) VALUES (2, 'Mouse', 'Electronics', 29.99)
  INTO products (id, name, category, price) VALUES (3, 'Keyboard', 'Electronics', 79.99)
SELECT * FROM dual;

-- Test 2: INSERT ALL with multiple tables
INSERT ALL
  INTO products (id, name, category, price) VALUES (4, 'Monitor', 'Electronics', 299.99)
  INTO suppliers (id, name, country) VALUES (1, 'TechCorp', 'USA')
  INTO suppliers (id, name, country) VALUES (2, 'GlobalTech', 'Germany')
SELECT * FROM dual;

-- Test 3: INSERT ALL with same table but different columns
INSERT ALL
  INTO products (id, name) VALUES (5, 'Desk')
  INTO products (id, name, price) VALUES (6, 'Chair', 149.99)
SELECT * FROM dual;

-- Test 4: Single INSERT for comparison
INSERT INTO suppliers (id, name, country)
VALUES (3, 'AsiaSupply', 'China');

-- Test 5: INSERT ALL with expressions
INSERT ALL
  INTO products (id, name, price) VALUES (7, UPPER('tablet'), 100 * 5)
  INTO products (id, name, price) VALUES (8, 'Headphones', 50.00 + 49.99)
SELECT * FROM dual;
