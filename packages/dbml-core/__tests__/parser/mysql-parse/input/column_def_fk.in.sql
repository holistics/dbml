-- MySQL Inline Column FOREIGN KEY Test Cases

-- Setup: Create referenced tables first
CREATE TABLE customers (
    cust_id INT PRIMARY KEY,
    cust_name VARCHAR(100)
);

CREATE TABLE products (
    product_id INT PRIMARY KEY,
    product_name VARCHAR(200)
);

CREATE TABLE categories (
    category_id INT PRIMARY KEY,
    category_name VARCHAR(100)
);

CREATE TABLE users (
    user_id INT PRIMARY KEY,
    username VARCHAR(50)
);

-- ============================================
-- BASIC INLINE FOREIGN KEY
-- ============================================

-- Simple FOREIGN KEY with REFERENCES
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    customer_id INT,
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);

-- Multiple FOREIGN KEYs
CREATE TABLE order_items (
    item_id INT PRIMARY KEY,
    order_id INT,
    product_id INT,
    CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
    CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- ============================================
-- FOREIGN KEY WITH REFERENTIAL ACTIONS
-- ============================================

-- ON DELETE CASCADE
CREATE TABLE invoices (
    invoice_id INT PRIMARY KEY,
    customer_id INT,
    CONSTRAINT fk_inv_cust FOREIGN KEY (customer_id) REFERENCES customers(cust_id) ON DELETE CASCADE
);

-- ON UPDATE CASCADE
CREATE TABLE shipments (
    shipment_id INT PRIMARY KEY,
    order_id INT,
    CONSTRAINT fk_ship_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE
);

-- ON DELETE SET NULL
CREATE TABLE reviews (
    review_id INT PRIMARY KEY,
    product_id INT,
    user_id INT,
    CONSTRAINT fk_rev_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

-- ON DELETE RESTRICT
CREATE TABLE payments (
    payment_id INT PRIMARY KEY,
    order_id INT,
    CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT
);

-- ON DELETE NO ACTION
CREATE TABLE transactions (
    trans_id INT PRIMARY KEY,
    user_id INT,
    CONSTRAINT fk_trans_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE NO ACTION
);

-- ON DELETE SET DEFAULT (MySQL specific - not always supported)
CREATE TABLE logs (
    log_id INT PRIMARY KEY,
    user_id INT DEFAULT 0,
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET DEFAULT
);

-- ============================================
-- FOREIGN KEY WITH COMBINED ACTIONS
-- ============================================

-- ON DELETE CASCADE ON UPDATE CASCADE
CREATE TABLE order_details (
    detail_id INT PRIMARY KEY,
    order_id INT,
    product_id INT,
    CONSTRAINT fk_od_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_od_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ON DELETE SET NULL ON UPDATE CASCADE
CREATE TABLE comments (
    comment_id INT PRIMARY KEY,
    user_id INT,
    product_id INT,
    CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ON DELETE RESTRICT ON UPDATE RESTRICT
CREATE TABLE audit_logs (
    audit_id INT PRIMARY KEY,
    user_id INT,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- ============================================
-- FOREIGN KEY WITH SCHEMA QUALIFIED REFERENCES
-- ============================================

CREATE SCHEMA IF NOT EXISTS hr;
CREATE TABLE hr.employees (
    emp_id INT PRIMARY KEY,
    emp_name VARCHAR(100)
);

-- Foreign key referencing table in different schema
CREATE TABLE projects (
    project_id INT PRIMARY KEY,
    manager_id INT,
    CONSTRAINT fk_proj_manager FOREIGN KEY (manager_id) REFERENCES hr.employees(emp_id)
);

-- ============================================
-- COMPOSITE FOREIGN KEY
-- ============================================

CREATE TABLE composite_pk_table (
    key1 INT,
    key2 INT,
    value VARCHAR(100),
    PRIMARY KEY (key1, key2)
);

-- Composite foreign key
CREATE TABLE composite_fk_table (
    id INT PRIMARY KEY,
    ref_key1 INT,
    ref_key2 INT,
    CONSTRAINT fk_composite FOREIGN KEY (ref_key1, ref_key2) REFERENCES composite_pk_table(key1, key2)
);

-- ============================================
-- FOREIGN KEY WITHOUT EXPLICIT CONSTRAINT NAME
-- ============================================

CREATE TABLE simple_fk (
    id INT PRIMARY KEY,
    customer_id INT,
    FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Self-referencing foreign key
CREATE TABLE employees (
    emp_id INT PRIMARY KEY,
    emp_name VARCHAR(100),
    manager_id INT,
    CONSTRAINT fk_emp_manager FOREIGN KEY (manager_id) REFERENCES employees(emp_id)
);

-- Foreign key with quoted identifiers
CREATE TABLE `order-history` (
    history_id INT PRIMARY KEY,
    `customer-id` INT,
    CONSTRAINT `fk-order-customer` FOREIGN KEY (`customer-id`) REFERENCES customers(cust_id)
);

-- Multiple foreign keys to same table
CREATE TABLE relationships (
    rel_id INT PRIMARY KEY,
    user1_id INT,
    user2_id INT,
    CONSTRAINT fk_user1 FOREIGN KEY (user1_id) REFERENCES users(user_id),
    CONSTRAINT fk_user2 FOREIGN KEY (user2_id) REFERENCES users(user_id)
);
