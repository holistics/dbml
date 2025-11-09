-- PostgreSQL In-Table FOREIGN KEY Test Cases

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
-- BASIC IN-TABLE FOREIGN KEY
-- ============================================

-- Simple FOREIGN KEY
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    order_date DATE,
    FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);

-- Named FOREIGN KEY
CREATE TABLE invoices (
    invoice_id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    invoice_date DATE,
    CONSTRAINT fk_inv_customer FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);

-- Multiple FOREIGN KEYs
CREATE TABLE order_items (
    item_id INTEGER PRIMARY KEY,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- ============================================
-- FOREIGN KEY WITH REFERENTIAL ACTIONS
-- ============================================

-- ON DELETE CASCADE
CREATE TABLE payments (
    payment_id INTEGER PRIMARY KEY,
    order_id INTEGER,
    amount NUMERIC(10,2),
    CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- ON UPDATE CASCADE
CREATE TABLE shipments (
    shipment_id INTEGER PRIMARY KEY,
    order_id INTEGER,
    ship_date DATE,
    CONSTRAINT fk_ship_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE
);

-- ON DELETE SET NULL
CREATE TABLE reviews (
    review_id INTEGER PRIMARY KEY,
    product_id INTEGER,
    user_id INTEGER,
    rating INTEGER,
    CONSTRAINT fk_rev_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    CONSTRAINT fk_rev_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ON DELETE RESTRICT
CREATE TABLE transactions (
    trans_id INTEGER PRIMARY KEY,
    user_id INTEGER,
    trans_date TIMESTAMP,
    CONSTRAINT fk_trans_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ON DELETE NO ACTION
CREATE TABLE audit_logs (
    log_id INTEGER PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(100),
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE NO ACTION
);

-- ON DELETE SET DEFAULT
CREATE TABLE logs (
    log_id INTEGER PRIMARY KEY,
    user_id INTEGER DEFAULT 0,
    log_message TEXT,
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET DEFAULT
);

-- ============================================
-- FOREIGN KEY WITH COMBINED ACTIONS
-- ============================================

-- ON DELETE CASCADE ON UPDATE CASCADE
CREATE TABLE order_details (
    detail_id INTEGER PRIMARY KEY,
    order_id INTEGER,
    product_id INTEGER,
    CONSTRAINT fk_od_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_od_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ON DELETE SET NULL ON UPDATE CASCADE
CREATE TABLE comments (
    comment_id INTEGER PRIMARY KEY,
    product_id INTEGER,
    user_id INTEGER,
    comment_text TEXT,
    CONSTRAINT fk_comment_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- COMPOSITE FOREIGN KEY
-- ============================================

CREATE TABLE composite_pk_table (
    key1 INTEGER,
    key2 INTEGER,
    value VARCHAR(100),
    PRIMARY KEY (key1, key2)
);

-- Composite foreign key
CREATE TABLE composite_fk_table (
    id INTEGER PRIMARY KEY,
    ref_key1 INTEGER,
    ref_key2 INTEGER,
    data VARCHAR(100),
    CONSTRAINT fk_composite FOREIGN KEY (ref_key1, ref_key2) REFERENCES composite_pk_table(key1, key2)
);

-- ============================================
-- FOREIGN KEY WITH MATCH OPTIONS
-- ============================================

-- MATCH SIMPLE (default)
CREATE TABLE test_fk_match_simple (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    CONSTRAINT fk_simple FOREIGN KEY (customer_id) REFERENCES customers(cust_id) MATCH SIMPLE
);

-- MATCH FULL
CREATE TABLE test_fk_match_full (
    id INTEGER PRIMARY KEY,
    ref_key1 INTEGER,
    ref_key2 INTEGER,
    CONSTRAINT fk_full FOREIGN KEY (ref_key1, ref_key2) REFERENCES composite_pk_table(key1, key2) MATCH FULL
);

-- ============================================
-- FOREIGN KEY WITH DEFERRABLE
-- ============================================

-- DEFERRABLE INITIALLY DEFERRED
CREATE TABLE test_fk_deferrable (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    CONSTRAINT fk_defer FOREIGN KEY (customer_id) REFERENCES customers(cust_id) DEFERRABLE INITIALLY DEFERRED
);

-- DEFERRABLE INITIALLY IMMEDIATE
CREATE TABLE test_fk_deferrable_immediate (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    CONSTRAINT fk_defer_imm FOREIGN KEY (customer_id) REFERENCES customers(cust_id) DEFERRABLE INITIALLY IMMEDIATE
);

-- NOT DEFERRABLE
CREATE TABLE test_fk_not_deferrable (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    CONSTRAINT fk_not_defer FOREIGN KEY (customer_id) REFERENCES customers(cust_id) NOT DEFERRABLE
);

-- ============================================
-- FOREIGN KEY WITH SCHEMA QUALIFICATION
-- ============================================

CREATE SCHEMA IF NOT EXISTS hr;
CREATE TABLE hr.employees (
    emp_id INTEGER PRIMARY KEY,
    emp_name VARCHAR(100)
);

CREATE TABLE projects (
    project_id INTEGER PRIMARY KEY,
    manager_id INTEGER,
    project_name VARCHAR(100),
    CONSTRAINT fk_proj_manager FOREIGN KEY (manager_id) REFERENCES hr.employees(emp_id)
);

-- ============================================
-- SELF-REFERENCING FOREIGN KEY
-- ============================================

CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY,
    category_name VARCHAR(100),
    parent_id INTEGER,
    CONSTRAINT fk_parent_category FOREIGN KEY (parent_id) REFERENCES categories(category_id)
);

CREATE TABLE employees (
    emp_id INTEGER PRIMARY KEY,
    emp_name VARCHAR(100),
    manager_id INTEGER,
    CONSTRAINT fk_emp_manager FOREIGN KEY (manager_id) REFERENCES employees(emp_id) ON DELETE SET NULL
);

-- ============================================
-- MULTIPLE FOREIGN KEYS TO SAME TABLE
-- ============================================

CREATE TABLE relationships (
    rel_id INTEGER PRIMARY KEY,
    user1_id INTEGER,
    user2_id INTEGER,
    rel_type VARCHAR(50),
    CONSTRAINT fk_user1 FOREIGN KEY (user1_id) REFERENCES users(user_id),
    CONSTRAINT fk_user2 FOREIGN KEY (user2_id) REFERENCES users(user_id)
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Foreign key with quoted identifiers
CREATE TABLE "order-history" (
    history_id INTEGER PRIMARY KEY,
    "customer-id" INTEGER,
    history_date DATE,
    CONSTRAINT "fk-order-customer" FOREIGN KEY ("customer-id") REFERENCES customers(cust_id)
);

-- Foreign key with all options combined
CREATE TABLE complex_fk (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    CONSTRAINT fk_complex FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
        MATCH FULL
        ON DELETE CASCADE
        ON UPDATE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);
