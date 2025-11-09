-- MySQL ALTER TABLE ADD PRIMARY KEY Test Cases

-- Setup: Create tables without PRIMARY KEY
CREATE TABLE test_add_pk_simple (
    id INT,
    name VARCHAR(100)
);

CREATE TABLE test_add_pk_composite (
    key1 INT,
    key2 INT,
    value VARCHAR(100)
);

CREATE TABLE test_add_pk_named (
    user_id INT,
    username VARCHAR(50)
);

-- ============================================
-- BASIC ALTER TABLE ADD PRIMARY KEY
-- ============================================

-- Add simple PRIMARY KEY
ALTER TABLE test_add_pk_simple ADD PRIMARY KEY (id);

-- Add composite PRIMARY KEY
ALTER TABLE test_add_pk_composite ADD PRIMARY KEY (key1, key2);

-- Add named PRIMARY KEY
ALTER TABLE test_add_pk_named ADD CONSTRAINT pk_user PRIMARY KEY (user_id);

-- ============================================
-- ALTER TABLE ADD PRIMARY KEY WITH DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_pk_varchar (
    code VARCHAR(20),
    description TEXT
);

ALTER TABLE test_pk_varchar ADD PRIMARY KEY (code);

CREATE TABLE test_pk_bigint (
    transaction_id BIGINT,
    amount DECIMAL(10,2)
);

ALTER TABLE test_pk_bigint ADD PRIMARY KEY (transaction_id);

-- ============================================
-- ALTER TABLE ADD PRIMARY KEY WITH INDEX OPTIONS
-- ============================================

CREATE TABLE test_pk_btree (
    id INT,
    data VARCHAR(100)
);

ALTER TABLE test_pk_btree ADD PRIMARY KEY (id) USING BTREE;

-- ============================================
-- EDGE CASES
-- ============================================

-- Add PRIMARY KEY with quoted identifiers
CREATE TABLE `test-pk-quoted` (
    `user-id` INT,
    `user-name` VARCHAR(100)
);

ALTER TABLE `test-pk-quoted` ADD CONSTRAINT `pk-user` PRIMARY KEY (`user-id`);

-- Add composite PRIMARY KEY with 3 columns
CREATE TABLE test_pk_composite_3 (
    year INT,
    month INT,
    day INT,
    data VARCHAR(100)
);

ALTER TABLE test_pk_composite_3 ADD PRIMARY KEY (year, month, day);

-- Schema-qualified table
CREATE SCHEMA IF NOT EXISTS test_schema;
CREATE TABLE test_schema.test_pk_schema (
    id INT,
    name VARCHAR(100)
);

ALTER TABLE test_schema.test_pk_schema ADD PRIMARY KEY (id);
