-- MySQL CREATE INDEX Test Cases

-- Setup tables
CREATE TABLE users (
    user_id INT PRIMARY KEY,
    username VARCHAR(50),
    email VARCHAR(100),
    created_at TIMESTAMP
);

CREATE TABLE products (
    product_id INT PRIMARY KEY,
    product_name VARCHAR(200),
    category VARCHAR(50),
    price DECIMAL(10,2),
    stock_level INT
);

-- ============================================
-- BASIC CREATE INDEX
-- ============================================

-- Simple index
CREATE INDEX idx_username ON users(username);

-- Index on multiple columns
CREATE INDEX idx_user_email ON users(email);

-- Composite index
CREATE INDEX idx_user_info ON users(username, email);

-- ============================================
-- UNIQUE INDEX
-- ============================================

-- Simple unique index
CREATE UNIQUE INDEX idx_email_unique ON users(email);

-- Composite unique index
CREATE UNIQUE INDEX idx_username_email_unique ON users(username, email);

-- ============================================
-- INDEX WITH DIFFERENT OPTIONS
-- ============================================

-- Index with USING BTREE
CREATE INDEX idx_btree ON users(username) USING BTREE;

-- Index with USING HASH
CREATE INDEX idx_hash ON users(user_id) USING HASH;

-- ============================================
-- INDEX ON DIFFERENT DATA TYPES
-- ============================================

CREATE INDEX idx_int ON products(stock_level);
CREATE INDEX idx_decimal ON products(price);
CREATE INDEX idx_varchar ON products(product_name);
CREATE INDEX idx_timestamp ON users(created_at);

-- ============================================
-- FULLTEXT INDEX
-- ============================================

-- Fulltext index
CREATE FULLTEXT INDEX idx_product_name_ft ON products(product_name);

-- Fulltext index on multiple columns
CREATE FULLTEXT INDEX idx_product_fulltext ON products(product_name, category);

-- ============================================
-- SPATIAL INDEX
-- ============================================

CREATE TABLE locations (
    location_id INT PRIMARY KEY,
    coordinates POINT NOT NULL SRID 4326
);

-- Spatial index
CREATE SPATIAL INDEX idx_coordinates ON locations(coordinates);

-- ============================================
-- INDEX WITH LENGTH SPECIFICATION
-- ============================================

-- Index with prefix length
CREATE INDEX idx_email_prefix ON users(email(20));

-- Composite index with prefix lengths
CREATE INDEX idx_composite_prefix ON users(username(10), email(20));

-- ============================================
-- EDGE CASES
-- ============================================

-- Index with quoted identifiers
CREATE INDEX `idx-user-data` ON users(`username`);

-- Schema-qualified table with index
CREATE SCHEMA IF NOT EXISTS test_schema;
CREATE TABLE test_schema.test_table (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);
CREATE INDEX idx_test ON test_schema.test_table(name);

-- Index IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_existing ON users(created_at);

-- Descending index
CREATE INDEX idx_created_desc ON users(created_at DESC);

-- Mixed ascending/descending composite index
CREATE INDEX idx_mixed_order ON users(username ASC, created_at DESC);
