-- MSSQL Inline Column PRIMARY KEY Test Cases

-- ============================================
-- BASIC INLINE PRIMARY KEY
-- ============================================

-- Simple INT PRIMARY KEY
CREATE TABLE test_pk_int (
    id INT PRIMARY KEY,
    name NVARCHAR(100)
);

-- BIGINT PRIMARY KEY
CREATE TABLE test_pk_bigint (
    user_id BIGINT PRIMARY KEY,
    username NVARCHAR(50)
);

-- NVARCHAR PRIMARY KEY
CREATE TABLE test_pk_nvarchar (
    code NVARCHAR(20) PRIMARY KEY,
    description NVARCHAR(MAX)
);

-- ============================================
-- PRIMARY KEY WITH IDENTITY
-- ============================================

-- IDENTITY PRIMARY KEY
CREATE TABLE test_pk_identity (
    id INT IDENTITY(1,1) PRIMARY KEY,
    data NVARCHAR(100)
);

-- PRIMARY KEY with IDENTITY different seed
CREATE TABLE test_pk_identity_seed (
    id INT IDENTITY(1000,1) PRIMARY KEY,
    value NVARCHAR(100)
);

-- PRIMARY KEY with IDENTITY increment
CREATE TABLE test_pk_identity_increment (
    id INT IDENTITY(1,10) PRIMARY KEY,
    info NVARCHAR(MAX)
);

-- ============================================
-- PRIMARY KEY WITH NOT NULL
-- ============================================

-- PRIMARY KEY with explicit NOT NULL
CREATE TABLE test_pk_not_null (
    id INT NOT NULL PRIMARY KEY,
    name NVARCHAR(100)
);

-- ============================================
-- PRIMARY KEY WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_pk_uniqueidentifier (
    id UNIQUEIDENTIFIER PRIMARY KEY,
    data NVARCHAR(100)
);

CREATE TABLE test_pk_varchar (
    code VARCHAR(20) PRIMARY KEY,
    description NVARCHAR(200)
);

CREATE TABLE test_pk_numeric (
    account_number NUMERIC(20,0) PRIMARY KEY,
    balance DECIMAL(12,2)
);

CREATE TABLE test_pk_date (
    event_date DATE PRIMARY KEY,
    event_name NVARCHAR(100)
);

-- ============================================
-- PRIMARY KEY WITH DEFAULT
-- ============================================

-- PRIMARY KEY with DEFAULT
CREATE TABLE test_pk_default (
    id INT PRIMARY KEY DEFAULT 1,
    name NVARCHAR(100)
);

-- PRIMARY KEY with UNIQUEIDENTIFIER default
CREATE TABLE test_pk_guid_default (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    data NVARCHAR(MAX)
);

-- ============================================
-- PRIMARY KEY WITH CLUSTERED/NONCLUSTERED
-- ============================================

-- CLUSTERED PRIMARY KEY
CREATE TABLE test_pk_clustered (
    id INT PRIMARY KEY CLUSTERED,
    name NVARCHAR(100)
);

-- NONCLUSTERED PRIMARY KEY
CREATE TABLE test_pk_nonclustered (
    id INT PRIMARY KEY NONCLUSTERED,
    data NVARCHAR(100)
);

-- ============================================
-- PRIMARY KEY WITH CONSTRAINT NAME
-- ============================================

-- PRIMARY KEY with named constraint
CREATE TABLE test_pk_named (
    id INT CONSTRAINT pk_test PRIMARY KEY,
    value NVARCHAR(MAX)
);

-- PRIMARY KEY with named constraint and CLUSTERED
CREATE TABLE test_pk_named_clustered (
    id INT CONSTRAINT pk_test_clustered PRIMARY KEY CLUSTERED,
    info NVARCHAR(200)
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Multiple columns, one PRIMARY KEY
CREATE TABLE test_pk_multi_col (
    id INT PRIMARY KEY,
    col1 NVARCHAR(50),
    col2 INT,
    col3 DATE
);

-- PRIMARY KEY with bracketed identifiers
CREATE TABLE test_pk_quoted (
    [order-id] INT PRIMARY KEY,
    order_date DATE
);

-- Schema-qualified table with PRIMARY KEY
CREATE SCHEMA test_schema;
GO

CREATE TABLE test_schema.test_pk_schema (
    emp_id INT PRIMARY KEY,
    emp_name NVARCHAR(100)
);

-- PRIMARY KEY IDENTITY with CLUSTERED
CREATE TABLE test_pk_identity_clustered (
    id INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    created_at DATETIME DEFAULT GETDATE()
);
