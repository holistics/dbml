-- MSSQL In-Table PRIMARY KEY Test Cases

-- ============================================
-- BASIC IN-TABLE PRIMARY KEY
-- ============================================

-- Simple PRIMARY KEY definition
CREATE TABLE test_pk_simple (
    id INT,
    name NVARCHAR(100),
    PRIMARY KEY (id)
);

-- PRIMARY KEY with constraint name
CREATE TABLE test_pk_named (
    id INT,
    email NVARCHAR(100),
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
    country NVARCHAR(50),
    state NVARCHAR(50),
    city NVARCHAR(50),
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
-- PRIMARY KEY WITH IDENTITY
-- ============================================

-- In-table PRIMARY KEY on IDENTITY column
CREATE TABLE test_pk_identity_inline (
    id INT IDENTITY(1,1),
    data NVARCHAR(100),
    PRIMARY KEY (id)
);

-- Named PRIMARY KEY with IDENTITY
CREATE TABLE test_pk_identity_named (
    user_id INT IDENTITY(1,1),
    username NVARCHAR(50),
    CONSTRAINT pk_user PRIMARY KEY (user_id)
);

-- ============================================
-- PRIMARY KEY WITH CLUSTERED/NONCLUSTERED
-- ============================================

-- CLUSTERED PRIMARY KEY
CREATE TABLE test_pk_clustered (
    id INT,
    name NVARCHAR(100),
    PRIMARY KEY CLUSTERED (id)
);

-- NONCLUSTERED PRIMARY KEY
CREATE TABLE test_pk_nonclustered (
    id INT,
    data NVARCHAR(100),
    PRIMARY KEY NONCLUSTERED (id)
);

-- Named CLUSTERED PRIMARY KEY
CREATE TABLE test_pk_named_clustered (
    id INT,
    value NVARCHAR(200),
    CONSTRAINT pk_clustered PRIMARY KEY CLUSTERED (id)
);

-- Named NONCLUSTERED PRIMARY KEY
CREATE TABLE test_pk_named_nonclustered (
    id INT,
    info NVARCHAR(MAX),
    CONSTRAINT pk_nonclustered PRIMARY KEY NONCLUSTERED (id)
);

-- ============================================
-- PRIMARY KEY WITH OTHER CONSTRAINTS
-- ============================================

-- PRIMARY KEY with UNIQUE on other column
CREATE TABLE test_pk_with_unique (
    id INT,
    email NVARCHAR(100) UNIQUE,
    username NVARCHAR(50) UNIQUE,
    PRIMARY KEY (id)
);

-- PRIMARY KEY with FOREIGN KEY
CREATE TABLE departments (
    dept_id INT PRIMARY KEY,
    dept_name NVARCHAR(100)
);

CREATE TABLE employees (
    emp_id INT,
    emp_name NVARCHAR(100),
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
-- PRIMARY KEY ON DIFFERENT DATA TYPES
-- ============================================

-- PRIMARY KEY on NVARCHAR
CREATE TABLE test_pk_nvarchar (
    code NVARCHAR(20),
    description NVARCHAR(MAX),
    PRIMARY KEY (code)
);

-- PRIMARY KEY on UNIQUEIDENTIFIER
CREATE TABLE test_pk_guid (
    id UNIQUEIDENTIFIER,
    data NVARCHAR(MAX),
    PRIMARY KEY (id)
);

-- PRIMARY KEY on BIGINT
CREATE TABLE test_pk_bigint (
    transaction_id BIGINT,
    amount DECIMAL(12,2),
    PRIMARY KEY (transaction_id)
);

-- PRIMARY KEY on NUMERIC
CREATE TABLE test_pk_numeric (
    account_number NUMERIC(20,0),
    balance DECIMAL(12,2),
    PRIMARY KEY (account_number)
);

-- Composite PRIMARY KEY with mixed types
CREATE TABLE test_pk_mixed_types (
    id INT,
    code NVARCHAR(20),
    date DATE,
    amount DECIMAL(10,2),
    PRIMARY KEY (id, code)
);

-- ============================================
-- PRIMARY KEY WITH INDEX OPTIONS
-- ============================================

-- PRIMARY KEY with filegroup
CREATE TABLE test_pk_filegroup (
    id INT,
    name NVARCHAR(100),
    PRIMARY KEY (id) ON [PRIMARY]
);

-- ============================================
-- EDGE CASES
-- ============================================

-- PRIMARY KEY with bracketed identifiers
CREATE TABLE [test-pk-quoted] (
    [user-id] INT,
    [user-name] NVARCHAR(100),
    PRIMARY KEY ([user-id])
);

-- Composite PRIMARY KEY with bracketed identifiers
CREATE TABLE [order-items] (
    [order-id] INT,
    [item-id] INT,
    quantity INT,
    CONSTRAINT [pk-order-item] PRIMARY KEY ([order-id], [item-id])
);

-- Schema-qualified table with PRIMARY KEY
CREATE TABLE test_schema.test_pk_schema (
    emp_id INT,
    emp_name NVARCHAR(100),
    PRIMARY KEY (emp_id)
);

-- Four-column composite PRIMARY KEY
CREATE TABLE test_pk_composite_4 (
    year INT,
    month INT,
    day INT,
    sequence INT,
    data NVARCHAR(200),
    PRIMARY KEY (year, month, day, sequence)
);

-- PRIMARY KEY with IDENTITY and CLUSTERED
CREATE TABLE test_pk_identity_clustered (
    id INT IDENTITY(1,1),
    created_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT pk_id_clustered PRIMARY KEY CLUSTERED (id)
);
