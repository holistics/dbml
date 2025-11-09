-- PostgreSQL Inline Column FOREIGN KEY Test Cases

-- Setup: Create referenced tables
CREATE TABLE customers (
    cust_id INTEGER PRIMARY KEY,
    cust_name VARCHAR(100)
);

CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    product_name VARCHAR(200)
);

CREATE TABLE users (
    user_id INTEGER PRIMARY KEY,
    username VARCHAR(50)
);

-- ============================================
-- BASIC INLINE FOREIGN KEY
-- ============================================

-- Simple FOREIGN KEY with REFERENCES
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(cust_id)
);

-- FOREIGN KEY with constraint name
CREATE TABLE invoices (
    invoice_id INTEGER PRIMARY KEY,
    customer_id INTEGER CONSTRAINT fk_customer REFERENCES customers(cust_id)
);

-- ============================================
-- FOREIGN KEY WITH REFERENTIAL ACTIONS
-- ============================================

-- ON DELETE CASCADE
CREATE TABLE payments (
    payment_id INTEGER PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id) ON DELETE CASCADE
);

-- ON UPDATE CASCADE
CREATE TABLE shipments (
    shipment_id INTEGER PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id) ON UPDATE CASCADE
);

-- ON DELETE SET NULL
CREATE TABLE reviews (
    review_id INTEGER PRIMARY KEY,
    product_id INTEGER REFERENCES products(product_id) ON DELETE SET NULL
);

-- ON DELETE RESTRICT
CREATE TABLE transactions (
    trans_id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ON DELETE NO ACTION
CREATE TABLE audit_logs (
    log_id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE NO ACTION
);

-- ON DELETE SET DEFAULT
CREATE TABLE logs (
    log_id INTEGER PRIMARY KEY,
    user_id INTEGER DEFAULT 0 REFERENCES users(user_id) ON DELETE SET DEFAULT
);

-- ============================================
-- FOREIGN KEY WITH COMBINED ACTIONS
-- ============================================

-- ON DELETE CASCADE ON UPDATE CASCADE
CREATE TABLE order_details (
    detail_id INTEGER PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ON DELETE SET NULL ON UPDATE CASCADE
CREATE TABLE comments (
    comment_id INTEGER PRIMARY KEY,
    product_id INTEGER REFERENCES products(product_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ON DELETE RESTRICT ON UPDATE RESTRICT
CREATE TABLE sensitive_data (
    data_id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- ============================================
-- FOREIGN KEY WITH SCHEMA QUALIFICATION
-- ============================================

CREATE SCHEMA IF NOT EXISTS hr;
CREATE TABLE hr.employees (
    emp_id INTEGER PRIMARY KEY,
    emp_name VARCHAR(100)
);

-- Foreign key referencing table in different schema
CREATE TABLE projects (
    project_id INTEGER PRIMARY KEY,
    manager_id INTEGER REFERENCES hr.employees(emp_id)
);

-- ============================================
-- SELF-REFERENCING FOREIGN KEY
-- ============================================

-- Self-referencing foreign key
CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY,
    category_name VARCHAR(100),
    parent_id INTEGER REFERENCES categories(category_id)
);

CREATE TABLE employees (
    emp_id INTEGER PRIMARY KEY,
    emp_name VARCHAR(100),
    manager_id INTEGER REFERENCES employees(emp_id) ON DELETE SET NULL
);

-- ============================================
-- FOREIGN KEY WITH MATCH OPTIONS
-- ============================================

-- MATCH SIMPLE (default)
CREATE TABLE test_fk_match_simple (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(cust_id) MATCH SIMPLE
);

-- MATCH FULL
CREATE TABLE test_fk_match_full (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(cust_id) MATCH FULL
);

-- ============================================
-- FOREIGN KEY WITH DEFERRABLE
-- ============================================

-- DEFERRABLE INITIALLY DEFERRED
CREATE TABLE test_fk_deferrable (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(cust_id) DEFERRABLE INITIALLY DEFERRED
);

-- DEFERRABLE INITIALLY IMMEDIATE
CREATE TABLE test_fk_deferrable_immediate (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(cust_id) DEFERRABLE INITIALLY IMMEDIATE
);

-- NOT DEFERRABLE
CREATE TABLE test_fk_not_deferrable (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(cust_id) NOT DEFERRABLE
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Foreign key with quoted identifiers
CREATE TABLE "order-history" (
    history_id INTEGER PRIMARY KEY,
    "customer-id" INTEGER CONSTRAINT "fk-customer" REFERENCES customers(cust_id)
);

-- Multiple inline foreign keys
CREATE TABLE order_items (
    item_id INTEGER PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER REFERENCES products(product_id)
);

-- Foreign key with all options
CREATE TABLE complex_fk (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER CONSTRAINT fk_complex REFERENCES customers(cust_id)
        MATCH FULL
        ON DELETE CASCADE
        ON UPDATE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);
