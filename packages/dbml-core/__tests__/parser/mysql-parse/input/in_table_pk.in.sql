-- MySQL In-Table PRIMARY KEY Test Cases

-- ============================================
-- BASIC IN-TABLE PRIMARY KEY
-- ============================================

-- Simple PRIMARY KEY definition
CREATE TABLE test_pk_simple (
    id INT,
    name VARCHAR(100),
    PRIMARY KEY (id)
);

-- PRIMARY KEY with constraint name
CREATE TABLE test_pk_named (
    id INT,
    email VARCHAR(100),
    CONSTRAINT pk_test PRIMARY KEY (id)
);

-- ============================================
-- COMPOSITE PRIMARY KEY
-- ============================================

-- Two-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_2 (
    user_id INT,
    account_id INT,
    balance DECIMAL(12,2),
    PRIMARY KEY (user_id, account_id)
);

-- Three-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_3 (
    country VARCHAR(50),
    state VARCHAR(50),
    city VARCHAR(50),
    population INT,
    PRIMARY KEY (country, state, city)
);

-- Named composite PRIMARY KEY
CREATE TABLE test_pk_composite_named (
    order_id INT,
    item_id INT,
    quantity INT,
    CONSTRAINT pk_order_item PRIMARY KEY (order_id, item_id)
);

-- ============================================
-- PRIMARY KEY WITH AUTO_INCREMENT
-- ============================================

-- In-table PRIMARY KEY on AUTO_INCREMENT column
CREATE TABLE test_pk_auto_inline (
    id INT AUTO_INCREMENT,
    data VARCHAR(100),
    PRIMARY KEY (id)
);

-- Named PRIMARY KEY with AUTO_INCREMENT
CREATE TABLE test_pk_auto_named (
    user_id INT AUTO_INCREMENT,
    username VARCHAR(50),
    CONSTRAINT pk_user PRIMARY KEY (user_id)
);

-- ============================================
-- PRIMARY KEY WITH OTHER CONSTRAINTS
-- ============================================

-- PRIMARY KEY with UNIQUE on other column
CREATE TABLE test_pk_with_unique (
    id INT,
    email VARCHAR(100) UNIQUE,
    username VARCHAR(50) UNIQUE,
    PRIMARY KEY (id)
);

-- PRIMARY KEY with FOREIGN KEY
CREATE TABLE departments (
    dept_id INT PRIMARY KEY,
    dept_name VARCHAR(100)
);

CREATE TABLE employees (
    emp_id INT,
    emp_name VARCHAR(100),
    dept_id INT,
    PRIMARY KEY (emp_id),
    CONSTRAINT fk_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- PRIMARY KEY with CHECK constraint
CREATE TABLE test_pk_with_check (
    id INT,
    age INT,
    salary DECIMAL(10,2),
    PRIMARY KEY (id),
    CHECK (age >= 18),
    CHECK (salary > 0)
);

-- ============================================
-- PRIMARY KEY WITH NOT NULL COLUMNS
-- ============================================

-- PRIMARY KEY on NOT NULL column
CREATE TABLE test_pk_not_null (
    id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (id)
);

-- Composite PRIMARY KEY on NOT NULL columns
CREATE TABLE test_pk_composite_not_null (
    key1 INT NOT NULL,
    key2 INT NOT NULL,
    value VARCHAR(100),
    PRIMARY KEY (key1, key2)
);

-- ============================================
-- PRIMARY KEY WITH DEFAULT VALUES
-- ============================================

-- PRIMARY KEY with DEFAULT on other columns
CREATE TABLE test_pk_with_defaults (
    id INT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- ============================================
-- PRIMARY KEY ON DIFFERENT DATA TYPES
-- ============================================

-- PRIMARY KEY on VARCHAR
CREATE TABLE test_pk_varchar (
    code VARCHAR(20),
    description TEXT,
    PRIMARY KEY (code)
);

-- PRIMARY KEY on CHAR
CREATE TABLE test_pk_char (
    country_code CHAR(2),
    country_name VARCHAR(100),
    PRIMARY KEY (country_code)
);

-- PRIMARY KEY on BIGINT
CREATE TABLE test_pk_bigint (
    transaction_id BIGINT,
    amount DECIMAL(12,2),
    PRIMARY KEY (transaction_id)
);

-- PRIMARY KEY on DECIMAL
CREATE TABLE test_pk_decimal (
    account_number DECIMAL(20,0),
    balance DECIMAL(12,2),
    PRIMARY KEY (account_number)
);

-- Composite PRIMARY KEY with mixed types
CREATE TABLE test_pk_mixed_types (
    id INT,
    code VARCHAR(20),
    date DATE,
    amount DECIMAL(10,2),
    PRIMARY KEY (id, code)
);

-- ============================================
-- PRIMARY KEY WITH INDEX OPTIONS
-- ============================================

-- PRIMARY KEY with USING BTREE (default in MySQL)
CREATE TABLE test_pk_btree (
    id INT,
    name VARCHAR(100),
    PRIMARY KEY (id) USING BTREE
);

-- PRIMARY KEY with USING HASH (MyISAM only)
CREATE TABLE test_pk_hash (
    id INT,
    data VARCHAR(100),
    PRIMARY KEY (id) USING HASH
) ENGINE=MEMORY;

-- ============================================
-- EDGE CASES
-- ============================================

-- PRIMARY KEY at end of table definition
CREATE TABLE test_pk_end (
    col1 VARCHAR(50),
    col2 INT,
    col3 DATE,
    id INT,
    PRIMARY KEY (id)
);

-- Multiple constraints including PRIMARY KEY
CREATE TABLE test_pk_multiple_constraints (
    id INT,
    email VARCHAR(100),
    username VARCHAR(50),
    dept_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (email),
    UNIQUE (username),
    CONSTRAINT fk_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- PRIMARY KEY with quoted identifiers
CREATE TABLE `test-pk-quoted` (
    `user-id` INT,
    `user-name` VARCHAR(100),
    PRIMARY KEY (`user-id`)
);

-- Composite PRIMARY KEY with quoted identifiers
CREATE TABLE `order-items` (
    `order-id` INT,
    `item-id` INT,
    quantity INT,
    CONSTRAINT `pk-order-item` PRIMARY KEY (`order-id`, `item-id`)
);

-- Schema-qualified table with PRIMARY KEY
CREATE TABLE hr.employees_pk (
    emp_id INT,
    emp_name VARCHAR(100),
    PRIMARY KEY (emp_id)
);

-- PRIMARY KEY on UNSIGNED columns
CREATE TABLE test_pk_unsigned (
    id INT UNSIGNED,
    counter BIGINT UNSIGNED,
    PRIMARY KEY (id)
);

-- Four-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_4 (
    year INT,
    month INT,
    day INT,
    sequence INT,
    data VARCHAR(200),
    PRIMARY KEY (year, month, day, sequence)
);

-- PRIMARY KEY with table options
CREATE TABLE test_pk_with_options (
    id INT,
    data VARCHAR(100),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
