-- MySQL In-Table FOREIGN KEY Test Cases

-- Setup: Create referenced tables
CREATE TABLE customers (
    cust_id INT PRIMARY KEY,
    cust_name VARCHAR(100)
);

CREATE TABLE products (
    product_id INT PRIMARY KEY,
    product_name VARCHAR(200)
);

CREATE TABLE users (
    user_id INT PRIMARY KEY,
    username VARCHAR(50)
);

-- ============================================
-- BASIC IN-TABLE FOREIGN KEY
-- ============================================

-- Simple FOREIGN KEY
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    customer_id INT,
    order_date DATE,
    FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);

-- Named FOREIGN KEY
CREATE TABLE invoices (
    invoice_id INT PRIMARY KEY,
    customer_id INT,
    invoice_date DATE,
    CONSTRAINT fk_inv_customer FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);

-- Multiple FOREIGN KEYs
CREATE TABLE order_items (
    item_id INT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- ============================================
-- FOREIGN KEY WITH REFERENTIAL ACTIONS
-- ============================================

-- ON DELETE CASCADE
CREATE TABLE payments (
    payment_id INT PRIMARY KEY,
    order_id INT,
    amount DECIMAL(10,2),
    CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- ON UPDATE CASCADE
CREATE TABLE shipments (
    shipment_id INT PRIMARY KEY,
    order_id INT,
    ship_date DATE,
    CONSTRAINT fk_ship_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE
);

-- ON DELETE SET NULL
CREATE TABLE reviews (
    review_id INT PRIMARY KEY,
    product_id INT,
    user_id INT,
    rating INT,
    CONSTRAINT fk_rev_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    CONSTRAINT fk_rev_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ON DELETE RESTRICT
CREATE TABLE transactions (
    trans_id INT PRIMARY KEY,
    user_id INT,
    trans_date TIMESTAMP,
    CONSTRAINT fk_trans_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ON DELETE NO ACTION
CREATE TABLE audit_logs (
    log_id INT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100),
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE NO ACTION
);

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
    product_id INT,
    user_id INT,
    comment_text TEXT,
    CONSTRAINT fk_comment_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ON DELETE RESTRICT ON UPDATE RESTRICT
CREATE TABLE sensitive_data (
    data_id INT PRIMARY KEY,
    user_id INT,
    data_value VARCHAR(200),
    CONSTRAINT fk_data_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT
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
    data VARCHAR(100),
    CONSTRAINT fk_composite FOREIGN KEY (ref_key1, ref_key2) REFERENCES composite_pk_table(key1, key2)
);

-- Named composite foreign key with actions
CREATE TABLE composite_fk_actions (
    id INT PRIMARY KEY,
    fk1 INT,
    fk2 INT,
    info TEXT,
    CONSTRAINT fk_comp_cascade FOREIGN KEY (fk1, fk2) REFERENCES composite_pk_table(key1, key2) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- FOREIGN KEY WITH SCHEMA QUALIFICATION
-- ============================================

CREATE SCHEMA IF NOT EXISTS hr;
CREATE TABLE hr.employees (
    emp_id INT PRIMARY KEY,
    emp_name VARCHAR(100)
);

CREATE TABLE projects (
    project_id INT PRIMARY KEY,
    manager_id INT,
    project_name VARCHAR(100),
    CONSTRAINT fk_proj_manager FOREIGN KEY (manager_id) REFERENCES hr.employees(emp_id)
);

-- ============================================
-- SELF-REFERENCING FOREIGN KEY
-- ============================================

CREATE TABLE categories (
    category_id INT PRIMARY KEY,
    category_name VARCHAR(100),
    parent_id INT,
    CONSTRAINT fk_parent_category FOREIGN KEY (parent_id) REFERENCES categories(category_id)
);

CREATE TABLE employees (
    emp_id INT PRIMARY KEY,
    emp_name VARCHAR(100),
    manager_id INT,
    CONSTRAINT fk_emp_manager FOREIGN KEY (manager_id) REFERENCES employees(emp_id) ON DELETE SET NULL
);

-- ============================================
-- MULTIPLE FOREIGN KEYS TO SAME TABLE
-- ============================================

CREATE TABLE relationships (
    rel_id INT PRIMARY KEY,
    user1_id INT,
    user2_id INT,
    rel_type VARCHAR(50),
    CONSTRAINT fk_user1 FOREIGN KEY (user1_id) REFERENCES users(user_id),
    CONSTRAINT fk_user2 FOREIGN KEY (user2_id) REFERENCES users(user_id)
);

CREATE TABLE transfers (
    transfer_id INT PRIMARY KEY,
    from_user_id INT,
    to_user_id INT,
    amount DECIMAL(10,2),
    CONSTRAINT fk_from_user FOREIGN KEY (from_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_to_user FOREIGN KEY (to_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ============================================
-- FOREIGN KEY WITH OTHER CONSTRAINTS
-- ============================================

-- FOREIGN KEY with UNIQUE
CREATE TABLE user_profiles (
    profile_id INT PRIMARY KEY,
    user_id INT UNIQUE,
    bio TEXT,
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- FOREIGN KEY with NOT NULL
CREATE TABLE mandatory_refs (
    id INT PRIMARY KEY,
    customer_id INT NOT NULL,
    product_id INT NOT NULL,
    CONSTRAINT fk_mand_customer FOREIGN KEY (customer_id) REFERENCES customers(cust_id),
    CONSTRAINT fk_mand_product FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- FOREIGN KEY with DEFAULT
CREATE TABLE logs (
    log_id INT PRIMARY KEY,
    user_id INT DEFAULT 1,
    log_message TEXT,
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Foreign key with quoted identifiers
CREATE TABLE `order-history` (
    history_id INT PRIMARY KEY,
    `customer-id` INT,
    history_date DATE,
    CONSTRAINT `fk-order-customer` FOREIGN KEY (`customer-id`) REFERENCES customers(cust_id)
);

-- Multiple foreign keys with complex actions
CREATE TABLE complex_refs (
    id INT PRIMARY KEY,
    cust_id INT,
    prod_id INT,
    user_id INT,
    order_id INT,
    CONSTRAINT fk_complex_cust FOREIGN KEY (cust_id) REFERENCES customers(cust_id) ON DELETE CASCADE,
    CONSTRAINT fk_complex_prod FOREIGN KEY (prod_id) REFERENCES products(product_id) ON DELETE SET NULL,
    CONSTRAINT fk_complex_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_complex_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON UPDATE CASCADE
);

-- Foreign key in temporary table
CREATE TEMPORARY TABLE temp_orders (
    temp_order_id INT PRIMARY KEY,
    customer_id INT,
    FOREIGN KEY (customer_id) REFERENCES customers(cust_id)
);
