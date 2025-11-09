-- MySQL In-Table CHECK Constraint Test Cases

-- ============================================
-- BASIC CHECK CONSTRAINTS
-- ============================================

-- Simple CHECK constraint
CREATE TABLE test_check_simple (
    id INT PRIMARY KEY,
    age INT,
    CHECK (age >= 18)
);

-- Named CHECK constraint
CREATE TABLE test_check_named (
    id INT PRIMARY KEY,
    salary DECIMAL(10,2),
    CONSTRAINT chk_salary UNIQUE (salary >= 0)
);

-- Multiple CHECK constraints
CREATE TABLE test_check_multiple (
    id INT PRIMARY KEY,
    age INT,
    salary DECIMAL(10,2),
    score INT,
    CHECK (age >= 0),
    CHECK (salary > 0),
    CHECK (score BETWEEN 0 AND 100)
);

-- Multiple named CHECK constraints
CREATE TABLE test_check_multiple_named (
    id INT PRIMARY KEY,
    quantity INT,
    price DECIMAL(10,2),
    discount DECIMAL(5,2),
    CONSTRAINT chk_quantity CHECK (quantity > 0),
    CONSTRAINT chk_price CHECK (price >= 0),
    CONSTRAINT chk_discount CHECK (discount BETWEEN 0 AND 100)
);

-- ============================================
-- CHECK WITH COMPARISON OPERATORS
-- ============================================

-- Greater than
CREATE TABLE test_check_gt (
    id INT PRIMARY KEY,
    amount DECIMAL(10,2),
    CHECK (amount > 0)
);

-- Greater than or equal
CREATE TABLE test_check_gte (
    id INT PRIMARY KEY,
    min_value INT,
    CHECK (min_value >= 0)
);

-- Less than
CREATE TABLE test_check_lt (
    id INT PRIMARY KEY,
    max_value INT,
    CHECK (max_value < 1000)
);

-- Less than or equal
CREATE TABLE test_check_lte (
    id INT PRIMARY KEY,
    limit_value INT,
    CHECK (limit_value <= 100)
);

-- Equality
CREATE TABLE test_check_eq (
    id INT PRIMARY KEY,
    status VARCHAR(20),
    CHECK (status = 'active' OR status = 'inactive')
);

-- Not equal
CREATE TABLE test_check_ne (
    id INT PRIMARY KEY,
    value INT,
    CHECK (value != 0)
);

-- ============================================
-- CHECK WITH LOGICAL OPERATORS
-- ============================================

-- AND condition
CREATE TABLE test_check_and (
    id INT PRIMARY KEY,
    age INT,
    CHECK (age >= 18 AND age <= 120)
);

-- OR condition
CREATE TABLE test_check_or (
    id INT PRIMARY KEY,
    role VARCHAR(20),
    CHECK (role = 'admin' OR role = 'user' OR role = 'guest')
);

-- NOT condition
CREATE TABLE test_check_not (
    id INT PRIMARY KEY,
    status VARCHAR(20),
    CHECK (NOT (status = 'deleted'))
);

-- Complex logical expression
CREATE TABLE test_check_complex_logic (
    id INT PRIMARY KEY,
    age INT,
    income DECIMAL(10,2),
    credit_score INT,
    CONSTRAINT chk_eligibility CHECK (
        (age >= 21 AND age <= 65) AND
        (income > 30000 OR credit_score > 700)
    )
);

-- ============================================
-- CHECK WITH IN OPERATOR
-- ============================================

-- IN with string values
CREATE TABLE test_check_in_string (
    id INT PRIMARY KEY,
    status VARCHAR(20),
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

-- IN with numeric values
CREATE TABLE test_check_in_numeric (
    id INT PRIMARY KEY,
    priority INT,
    CHECK (priority IN (1, 2, 3, 4, 5))
);

-- NOT IN
CREATE TABLE test_check_not_in (
    id INT PRIMARY KEY,
    department VARCHAR(50),
    CHECK (department NOT IN ('restricted1', 'restricted2'))
);

-- ============================================
-- CHECK WITH BETWEEN
-- ============================================

-- BETWEEN with integers
CREATE TABLE test_check_between_int (
    id INT PRIMARY KEY,
    age INT,
    CHECK (age BETWEEN 18 AND 100)
);

-- BETWEEN with decimals
CREATE TABLE test_check_between_decimal (
    id INT PRIMARY KEY,
    percentage DECIMAL(5,2),
    CHECK (percentage BETWEEN 0.00 AND 100.00)
);

-- NOT BETWEEN
CREATE TABLE test_check_not_between (
    id INT PRIMARY KEY,
    value INT,
    CHECK (value NOT BETWEEN -10 AND 10)
);

-- ============================================
-- CHECK WITH NULL
-- ============================================

-- IS NULL
CREATE TABLE test_check_is_null (
    id INT PRIMARY KEY,
    optional_field VARCHAR(100),
    required_field VARCHAR(100),
    CHECK (required_field IS NOT NULL)
);

-- IS NOT NULL
CREATE TABLE test_check_is_not_null (
    id INT PRIMARY KEY,
    mandatory_field VARCHAR(100),
    CHECK (mandatory_field IS NOT NULL)
);

-- ============================================
-- CHECK WITH LIKE
-- ============================================

-- LIKE pattern
CREATE TABLE test_check_like (
    id INT PRIMARY KEY,
    email VARCHAR(100),
    CHECK (email LIKE '%@%.%')
);

-- NOT LIKE pattern
CREATE TABLE test_check_not_like (
    id INT PRIMARY KEY,
    username VARCHAR(50),
    CHECK (username NOT LIKE '%admin%')
);

-- ============================================
-- CHECK WITH MULTIPLE COLUMNS
-- ============================================

-- CHECK referencing multiple columns
CREATE TABLE test_check_multi_column (
    id INT PRIMARY KEY,
    start_date DATE,
    end_date DATE,
    CHECK (end_date >= start_date)
);

-- Complex multi-column CHECK
CREATE TABLE test_check_multi_complex (
    id INT PRIMARY KEY,
    min_value INT,
    max_value INT,
    current_value INT,
    CONSTRAINT chk_range CHECK (
        current_value >= min_value AND
        current_value <= max_value AND
        max_value > min_value
    )
);

-- ============================================
-- CHECK WITH OTHER CONSTRAINTS
-- ============================================

-- CHECK with PRIMARY KEY
CREATE TABLE test_check_with_pk (
    id INT PRIMARY KEY CHECK (id > 0),
    name VARCHAR(100)
);

-- CHECK with UNIQUE
CREATE TABLE test_check_with_unique (
    id INT PRIMARY KEY,
    email VARCHAR(100) UNIQUE,
    age INT,
    CHECK (age >= 18)
);

-- CHECK with FOREIGN KEY
CREATE TABLE departments (
    dept_id INT PRIMARY KEY,
    dept_name VARCHAR(100)
);

CREATE TABLE employees_check (
    emp_id INT PRIMARY KEY,
    dept_id INT,
    salary DECIMAL(10,2),
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
    CHECK (salary > 0)
);

-- CHECK with NOT NULL
CREATE TABLE test_check_with_not_null (
    id INT PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL,
    CHECK (amount > 0),
    CHECK (quantity > 0)
);

-- CHECK with DEFAULT
CREATE TABLE test_check_with_default (
    id INT PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'pending',
    priority INT DEFAULT 1,
    CHECK (status IN ('pending', 'active', 'completed')),
    CHECK (priority BETWEEN 1 AND 5)
);

-- ============================================
-- EDGE CASES
-- ============================================

-- CHECK with quoted identifiers
CREATE TABLE `test-check-quoted` (
    id INT PRIMARY KEY,
    `user-age` INT,
    CONSTRAINT `chk-age` CHECK (`user-age` >= 18)
);

-- Schema-qualified table with CHECK
CREATE SCHEMA IF NOT EXISTS test_schema;
CREATE TABLE test_schema.test_check_schema (
    id INT PRIMARY KEY,
    value INT,
    CHECK (value > 0)
);

-- CHECK with expression
CREATE TABLE test_check_expression (
    id INT PRIMARY KEY,
    quantity INT,
    price DECIMAL(10,2),
    CHECK (quantity * price < 10000)
);

-- Multiple overlapping CHECKs
CREATE TABLE test_check_overlapping (
    id INT PRIMARY KEY,
    value INT,
    CHECK (value > 0),
    CHECK (value < 1000),
    CHECK (value != 500)
);

-- Complex CHECK with all operators
CREATE TABLE test_check_comprehensive (
    id INT PRIMARY KEY,
    age INT,
    salary DECIMAL(10,2),
    status VARCHAR(20),
    department VARCHAR(50),
    start_date DATE,
    end_date DATE,
    CONSTRAINT chk_age CHECK (age BETWEEN 18 AND 65),
    CONSTRAINT chk_salary CHECK (salary >= 30000 AND salary <= 500000),
    CONSTRAINT chk_status CHECK (status IN ('active', 'inactive', 'suspended')),
    CONSTRAINT chk_dept CHECK (department NOT LIKE '%test%'),
    CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date > start_date)
);
