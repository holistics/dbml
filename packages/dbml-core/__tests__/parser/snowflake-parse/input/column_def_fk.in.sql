-- Snowflake Inline Column FOREIGN KEY Test Cases

-- Setup: Create referenced tables
CREATE TABLE customers (
    cust_id NUMBER PRIMARY KEY,
    cust_name VARCHAR(100)
);

CREATE TABLE products (
    product_id NUMBER PRIMARY KEY,
    product_name VARCHAR(200)
);

CREATE TABLE users (
    user_id NUMBER PRIMARY KEY,
    username VARCHAR(50)
);

-- ============================================
-- BASIC INLINE FOREIGN KEY
-- ============================================

-- Simple FOREIGN KEY with REFERENCES
CREATE TABLE orders (
    order_id NUMBER PRIMARY KEY,
    customer_id NUMBER REFERENCES customers(cust_id)
);

-- FOREIGN KEY with constraint name
CREATE TABLE invoices (
    invoice_id NUMBER PRIMARY KEY,
    customer_id NUMBER CONSTRAINT fk_customer REFERENCES customers(cust_id)
);

-- ============================================
-- FOREIGN KEY WITH REFERENTIAL ACTIONS
-- ============================================

-- ON DELETE CASCADE
CREATE TABLE payments (
    payment_id NUMBER PRIMARY KEY,
    order_id NUMBER REFERENCES orders(order_id) ON DELETE CASCADE
);

-- ON UPDATE CASCADE
CREATE TABLE shipments (
    shipment_id NUMBER PRIMARY KEY,
    order_id NUMBER REFERENCES orders(order_id) ON UPDATE CASCADE
);

-- ON DELETE SET NULL
CREATE TABLE reviews (
    review_id NUMBER PRIMARY KEY,
    product_id NUMBER REFERENCES products(product_id) ON DELETE SET NULL
);

-- ON DELETE RESTRICT
CREATE TABLE transactions (
    trans_id NUMBER PRIMARY KEY,
    user_id NUMBER REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ON DELETE NO ACTION
CREATE TABLE audit_logs (
    log_id NUMBER PRIMARY KEY,
    user_id NUMBER REFERENCES users(user_id) ON DELETE NO ACTION
);

-- ON DELETE SET DEFAULT
CREATE TABLE logs (
    log_id NUMBER PRIMARY KEY,
    user_id NUMBER DEFAULT 0 REFERENCES users(user_id) ON DELETE SET DEFAULT
);

-- ============================================
-- FOREIGN KEY WITH COMBINED ACTIONS
-- ============================================

-- ON DELETE CASCADE ON UPDATE CASCADE
CREATE TABLE order_details (
    detail_id NUMBER PRIMARY KEY,
    order_id NUMBER REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ON DELETE SET NULL ON UPDATE CASCADE
CREATE TABLE comments (
    comment_id NUMBER PRIMARY KEY,
    product_id NUMBER REFERENCES products(product_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ON DELETE RESTRICT ON UPDATE RESTRICT
CREATE TABLE sensitive_data (
    data_id NUMBER PRIMARY KEY,
    user_id NUMBER REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- ============================================
-- FOREIGN KEY WITH SCHEMA QUALIFICATION
-- ============================================

CREATE SCHEMA hr;

CREATE TABLE hr.employees (
    emp_id NUMBER PRIMARY KEY,
    emp_name VARCHAR(100)
);

-- Foreign key referencing table in different schema
CREATE TABLE projects (
    project_id NUMBER PRIMARY KEY,
    manager_id NUMBER REFERENCES hr.employees(emp_id)
);

-- ============================================
-- SELF-REFERENCING FOREIGN KEY
-- ============================================

-- Self-referencing foreign key
CREATE TABLE categories (
    category_id NUMBER PRIMARY KEY,
    category_name VARCHAR(100),
    parent_id NUMBER REFERENCES categories(category_id)
);

CREATE TABLE employees (
    emp_id NUMBER PRIMARY KEY,
    emp_name VARCHAR(100),
    manager_id NUMBER REFERENCES employees(emp_id) ON DELETE SET NULL
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Foreign key with quoted identifiers
CREATE TABLE "order-history" (
    history_id NUMBER PRIMARY KEY,
    "customer-id" NUMBER CONSTRAINT "fk-customer" REFERENCES customers(cust_id)
);

-- Multiple inline foreign keys
CREATE TABLE order_items (
    item_id NUMBER PRIMARY KEY,
    order_id NUMBER REFERENCES orders(order_id),
    product_id NUMBER REFERENCES products(product_id)
);

-- Foreign key with all options
CREATE TABLE complex_fk (
    id NUMBER PRIMARY KEY,
    customer_id NUMBER CONSTRAINT fk_complex REFERENCES customers(cust_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
