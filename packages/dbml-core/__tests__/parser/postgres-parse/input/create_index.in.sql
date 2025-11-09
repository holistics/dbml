-- PostgreSQL CREATE INDEX Test Cases

-- Setup tables
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY,
    username VARCHAR(50),
    email VARCHAR(100),
    created_at TIMESTAMP
);

CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    product_name VARCHAR(200),
    category VARCHAR(50),
    price NUMERIC(10,2),
    stock_level INTEGER
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

-- Index with USING GIN
CREATE TABLE documents (
    doc_id INTEGER PRIMARY KEY,
    content TEXT,
    tags TEXT[]
);

CREATE INDEX idx_gin ON documents USING GIN(tags);

-- Index with USING GIST
CREATE TABLE locations (
    location_id INTEGER PRIMARY KEY,
    coordinates POINT
);

CREATE INDEX idx_gist ON locations USING GIST(coordinates);

-- Index with USING BRIN
CREATE INDEX idx_brin ON users(created_at) USING BRIN;

-- ============================================
-- INDEX ON DIFFERENT DATA TYPES
-- ============================================

CREATE INDEX idx_int ON products(stock_level);
CREATE INDEX idx_numeric ON products(price);
CREATE INDEX idx_varchar ON products(product_name);
CREATE INDEX idx_timestamp ON users(created_at);

-- ============================================
-- PARTIAL INDEX
-- ============================================

-- Partial index with WHERE clause
CREATE INDEX idx_active_users ON users(username) WHERE created_at > '2020-01-01';

-- Partial index with complex condition
CREATE INDEX idx_premium_products ON products(product_name) WHERE price > 100 AND stock_level > 0;

-- ============================================
-- INDEX WITH EXPRESSIONS
-- ============================================

-- Index on expression
CREATE INDEX idx_lower_username ON users(LOWER(username));

-- Index on complex expression
CREATE INDEX idx_full_name ON users((username || ' ' || email));

-- ============================================
-- INDEX WITH COLLATION
-- ============================================

-- Index with collation
CREATE INDEX idx_username_collate ON users(username COLLATE "en_US");

-- ============================================
-- INDEX WITH NULL ORDERING
-- ============================================

-- Index with NULLS FIRST
CREATE INDEX idx_nulls_first ON users(email NULLS FIRST);

-- Index with NULLS LAST
CREATE INDEX idx_nulls_last ON users(email NULLS LAST);

-- ============================================
-- INDEX WITH SORT ORDER
-- ============================================

-- Descending index
CREATE INDEX idx_created_desc ON users(created_at DESC);

-- Mixed ascending/descending composite index
CREATE INDEX idx_mixed_order ON users(username ASC, created_at DESC);

-- ============================================
-- INDEX WITH STORAGE PARAMETERS
-- ============================================

-- Index with fillfactor
CREATE INDEX idx_with_fillfactor ON users(username) WITH (fillfactor=70);

-- ============================================
-- INDEX WITH TABLESPACE
-- ============================================

-- Index with tablespace
CREATE INDEX idx_with_tablespace ON users(username) TABLESPACE pg_default;

-- ============================================
-- CONCURRENT INDEX
-- ============================================

-- Create index concurrently
CREATE INDEX CONCURRENTLY idx_concurrent ON users(email);

-- ============================================
-- INDEX IF NOT EXISTS
-- ============================================

-- Index IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_existing ON users(created_at);

-- ============================================
-- EDGE CASES
-- ============================================

-- Index with quoted identifiers
CREATE INDEX "idx-user-data" ON users(username);

-- Schema-qualified table with index
CREATE SCHEMA IF NOT EXISTS test_schema;
CREATE TABLE test_schema.test_table (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100)
);
CREATE INDEX idx_test ON test_schema.test_table(name);

-- Index on JSONB column
CREATE TABLE json_data (
    id INTEGER PRIMARY KEY,
    data JSONB
);

CREATE INDEX idx_jsonb ON json_data USING GIN(data);

-- Index on array column
CREATE INDEX idx_array ON documents(tags);
