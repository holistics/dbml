-- Test ALTER TABLE ADD CHECK constraints for MySQL

CREATE TABLE products (
  id INT PRIMARY KEY,
  price DECIMAL(10,4)
);

-- Add unnamed CHECK constraint
ALTER TABLE products ADD CHECK (price > 0);

-- Add named CHECK constraint
ALTER TABLE products ADD CONSTRAINT chk_price_upper CHECK (price <= 1000000);

CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  age INT,
  salary DECIMAL(10,2)
);

-- Add multiple CHECK constraints
ALTER TABLE employees ADD CONSTRAINT chk_age CHECK (age >= 18 AND age <= 65);
ALTER TABLE employees ADD CONSTRAINT chk_salary CHECK (salary > 0);
