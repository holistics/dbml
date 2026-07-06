-- Test INSERT ALL statement parsing

CREATE TABLE employees (
  id NUMBER PRIMARY KEY,
  name VARCHAR2(100),
  department VARCHAR2(50),
  salary NUMBER
);

CREATE TABLE departments (
  id NUMBER PRIMARY KEY,
  name VARCHAR2(100)
);

-- Test 1: Basic INSERT ALL with same table and columns
INSERT ALL
  INTO employees (id, name, department, salary) VALUES (1, 'Alice', 'Engineering', 75000)
  INTO employees (id, name, department, salary) VALUES (2, 'Bob', 'Engineering', 80000)
  INTO employees (id, name, department, salary) VALUES (3, 'Charlie', 'Engineering', 70000)
SELECT * FROM dual;

-- Test 2: INSERT ALL with different tables
INSERT ALL
  INTO employees (id, name, department, salary) VALUES (4, 'Diana', 'Sales', 65000)
  INTO departments (id, name) VALUES (1, 'Engineering')
  INTO departments (id, name) VALUES (2, 'Sales')
SELECT * FROM dual;

-- Test 3: INSERT ALL with same table but different column sets
INSERT ALL
  INTO employees (id, name) VALUES (5, 'Eve')
  INTO employees (id, name, department) VALUES (6, 'Frank', 'Marketing')
  INTO employees (id, name, department, salary) VALUES (7, 'Grace', 'Marketing', 72000)
SELECT * FROM dual;

-- Test 4: Single INSERT statement (for comparison)
INSERT INTO employees (id, name, department, salary)
VALUES (8, 'Henry', 'HR', 68000);

-- Test 5: INSERT ALL with expressions
INSERT ALL
  INTO employees (id, name, salary) VALUES (9, 'Iris', 50000 + 20000)
  INTO employees (id, name, salary) VALUES (10, UPPER('jack'), 75000)
SELECT * FROM dual;
