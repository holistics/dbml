-- MSSQL Inline Column FOREIGN KEY Test Cases

-- Setup: Create referenced tables
CREATE TABLE customers (
    cust_id INT PRIMARY KEY,
    cust_name NVARCHAR(100)
);

CREATE TABLE products (
    product_id INT PRIMARY KEY,
    product_name NVARCHAR(200)
);

CREATE TABLE users (
    user_id INT PRIMARY KEY,
    username NVARCHAR(50)
);

-- ============================================
-- BASIC INLINE FOREIGN KEY
-- ============================================

-- Simple FOREIGN KEY with REFERENCES
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    customer_id INT REFERENCES customers(cust_id)
);

-- FOREIGN KEY with constraint name
CREATE TABLE invoices (
    invoice_id INT PRIMARY KEY,
    customer_id INT CONSTRAINT fk_customer REFERENCES customers(cust_id)
);

-- ============================================
-- FOREIGN KEY WITH REFERENTIAL ACTIONS
-- ============================================

-- ON DELETE CASCADE
CREATE TABLE payments (
    payment_id INT PRIMARY KEY,
    order_id INT REFERENCES orders(order_id) ON DELETE CASCADE
);

-- ON UPDATE CASCADE
CREATE TABLE shipments (
    shipment_id INT PRIMARY KEY,
    order_id INT REFERENCES orders(order_id) ON UPDATE CASCADE
);

-- ON DELETE SET NULL
CREATE TABLE reviews (
    review_id INT PRIMARY KEY,
    product_id INT REFERENCES products(product_id) ON DELETE SET NULL
);

-- ON DELETE SET DEFAULT
CREATE TABLE logs (
    log_id INT PRIMARY KEY,
    user_id INT DEFAULT 0 REFERENCES users(user_id) ON DELETE SET DEFAULT
);

-- ON DELETE NO ACTION
CREATE TABLE audit_logs (
    log_id INT PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE NO ACTION
);

-- ============================================
-- FOREIGN KEY WITH COMBINED ACTIONS
-- ============================================

-- ON DELETE CASCADE ON UPDATE CASCADE
CREATE TABLE order_details (
    detail_id INT PRIMARY KEY,
    order_id INT REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ON DELETE SET NULL ON UPDATE CASCADE
CREATE TABLE comments (
    comment_id INT PRIMARY KEY,
    product_id INT REFERENCES products(product_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ON DELETE NO ACTION ON UPDATE NO ACTION
CREATE TABLE sensitive_data (
    data_id INT PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ============================================
-- FOREIGN KEY WITH SCHEMA QUALIFICATION
-- ============================================

CREATE SCHEMA hr;
GO

CREATE TABLE hr.employees (
    emp_id INT PRIMARY KEY,
    emp_name NVARCHAR(100)
);

-- Foreign key referencing table in different schema
CREATE TABLE projects (
    project_id INT PRIMARY KEY,
    manager_id INT REFERENCES hr.employees(emp_id)
);

-- ============================================
-- SELF-REFERENCING FOREIGN KEY
-- ============================================

-- Self-referencing foreign key
CREATE TABLE categories (
    category_id INT PRIMARY KEY,
    category_name NVARCHAR(100),
    parent_id INT REFERENCES categories(category_id)
);

CREATE TABLE employees (
    emp_id INT PRIMARY KEY,
    emp_name NVARCHAR(100),
    manager_id INT REFERENCES employees(emp_id) ON DELETE NO ACTION
);

-- ============================================
-- EDGE CASES
-- ============================================

-- Foreign key with bracketed identifiers
CREATE TABLE [order-history] (
    history_id INT PRIMARY KEY,
    [customer-id] INT CONSTRAINT [fk-customer] REFERENCES customers(cust_id)
);

-- Multiple inline foreign keys
CREATE TABLE order_items (
    item_id INT PRIMARY KEY,
    order_id INT REFERENCES orders(order_id),
    product_id INT REFERENCES products(product_id)
);

-- Foreign key with all options
CREATE TABLE complex_fk (
    id INT PRIMARY KEY,
    customer_id INT CONSTRAINT fk_complex REFERENCES customers(cust_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Foreign key with NOT FOR REPLICATION
CREATE TABLE replicated_orders (
    order_id INT PRIMARY KEY,
    customer_id INT REFERENCES customers(cust_id) NOT FOR REPLICATION
);
