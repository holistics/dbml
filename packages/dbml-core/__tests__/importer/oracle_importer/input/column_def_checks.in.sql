-- Oracle SQL Inline CHECK Constraint Test Cases
-- Test setup: Create tables with inline CHECK constraints on different columns
CREATE TABLE customers (
    cust_id NUMBER(10) CONSTRAINT chk_cust_id_pos CHECK (cust_id > 0),
    cust_name VARCHAR2(100) CONSTRAINT chk_cust_name_len CHECK (LENGTH(cust_name) <= 100),
    email VARCHAR2(100) CONSTRAINT chk_email_format CHECK (email LIKE '%@%.%'),
    phone VARCHAR2(20) CONSTRAINT chk_phone_len CHECK (LENGTH(phone) >= 10),
    address VARCHAR2(200) CONSTRAINT chk_address_not_empty CHECK (address IS NOT NULL),
    status VARCHAR2(20) CONSTRAINT chk_cust_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    reg_date DATE CONSTRAINT chk_reg_date CHECK (reg_date >= TO_DATE('2000-01-01', 'YYYY-MM-DD')),
    last_login TIMESTAMP CONSTRAINT chk_last_login CHECK (last_login <= SYSTIMESTAMP) CONSTRAINT chk_last_login_2 CHECK (last_login >= SYSTIMESTAMP),
    last_login_2 TIMESTAMP CHECK (last_login_2 <= SYSTIMESTAMP) CHECK (last_login_2 >= SYSTIMESTAMP),
    last_login_3 TIMESTAMP CHECK (last_login_3 <= SYSTIMESTAMP) CONSTRAINT chk_last_login_3 CHECK (last_login_3 >= SYSTIMESTAMP)
);

CREATE TABLE inventory (
    item_id NUMBER(10) CONSTRAINT chk_item_id_pos CHECK (item_id > 0),
    item_name VARCHAR2(200) CONSTRAINT chk_item_name CHECK (item_name IS NOT NULL),
    price NUMBER(10,2) CONSTRAINT chk_price_pos CHECK (price >= 0),
    category VARCHAR2(50) CONSTRAINT chk_category_valid CHECK (category IN ('ELECTRONICS', 'CLOTHING', 'BOOKS')),
    sku VARCHAR2(50) CONSTRAINT chk_sku_len CHECK (LENGTH(sku) <= 50),
    weight NUMBER(8,2) CONSTRAINT chk_weight_pos CHECK (weight > 0),
    stock_level NUMBER(10) CONSTRAINT chk_stock_level CHECK (stock_level >= 0),
    reorder_level NUMBER(10) CONSTRAINT chk_reorder_level CHECK (reorder_level >= 0)
);

CREATE TABLE shipments (
    ship_id NUMBER(10) CONSTRAINT chk_ship_id CHECK (ship_id > 0),
    customer_id NUMBER(10) CONSTRAINT chk_cust_id_valid CHECK (customer_id > 0),
    ship_date DATE CONSTRAINT chk_ship_date CHECK (ship_date >= TRUNC(SYSDATE)),
    total_amount NUMBER(12,2) CONSTRAINT chk_total_amount CHECK (total_amount >= 0),
    tracking_number VARCHAR2(50) CONSTRAINT chk_tracking_len CHECK (LENGTH(tracking_number) <= 50),
    carrier VARCHAR2(100) CONSTRAINT chk_carrier CHECK (carrier IS NOT NULL),
    priority NUMBER(2) CONSTRAINT chk_priority_range CHECK (priority BETWEEN 1 AND 5),
    notes VARCHAR2(4000) CONSTRAINT chk_notes_len CHECK (LENGTH(notes) <= 4000)
);

CREATE TABLE departments (
    dept_id NUMBER(10) CONSTRAINT chk_dept_id CHECK (dept_id > 0),
    dept_name VARCHAR2(100) CONSTRAINT chk_dept_name CHECK (dept_name IS NOT NULL),
    manager_id NUMBER(10) CONSTRAINT chk_manager_id CHECK (manager_id > 0),
    budget NUMBER(12,2) CONSTRAINT chk_budget_pos CHECK (budget >= 0),
    location VARCHAR2(50) CONSTRAINT chk_location CHECK (location IS NOT NULL),
    established_date DATE CONSTRAINT chk_est_date CHECK (established_date <= SYSDATE)
);

CREATE TABLE suppliers (
    supp_id NUMBER(10) CONSTRAINT chk_supp_id CHECK (supp_id > 0),
    supp_name VARCHAR2(100) CONSTRAINT chk_supp_name CHECK (supp_name IS NOT NULL),
    contact VARCHAR2(100) CONSTRAINT chk_contact_len CHECK (LENGTH(contact) <= 100),
    ssn VARCHAR2(11) CONSTRAINT chk_ssn_format CHECK (ssn LIKE '___-__-____'),
    badge_number VARCHAR2(10) CONSTRAINT chk_badge_len CHECK (LENGTH(badge_number) <= 10),
    credit_limit NUMBER(10,2) CONSTRAINT chk_credit_limit CHECK (credit_limit >= 0)
);

CREATE TABLE test_datatypes (
    col_number NUMBER(10,2) CONSTRAINT chk_number_pos CHECK (col_number >= 0),
    col_varchar2 VARCHAR2(100) CONSTRAINT chk_varchar2_len CHECK (LENGTH(col_varchar2) <= 100),
    col_char CHAR(10) CONSTRAINT chk_char_len CHECK (LENGTH(col_char) = 10),
    col_date DATE CONSTRAINT chk_date CHECK (col_date >= TO_DATE('2000-01-01', 'YYYY-MM-DD')),
    col_timestamp TIMESTAMP CONSTRAINT chk_timestamp CHECK (col_timestamp <= SYSTIMESTAMP),
    col_clob CLOB CONSTRAINT chk_clob_not_null CHECK (col_clob IS NOT NULL),
    col_raw RAW(100) CONSTRAINT chk_raw_len CHECK (LENGTH(col_raw) <= 100),
    col_float FLOAT CONSTRAINT chk_float_pos CHECK (col_float >= 0),
    col_integer INTEGER CONSTRAINT chk_integer_pos CHECK (col_integer >= 0),
    col_nvarchar2 NVARCHAR2(100) CONSTRAINT chk_nvarchar2_len CHECK (LENGTH(col_nvarchar2) <= 100),
    col_nchar NCHAR(10) CONSTRAINT chk_nchar_len CHECK (LENGTH(col_nchar) = 10)
);

-- ============================================
-- BASIC INLINE CHECK CONSTRAINTS
-- ============================================

-- Simple CHECK constraint (numeric comparison)
CREATE TABLE test_basic (
    id NUMBER(10) CONSTRAINT chk_id_pos CHECK (id > 0),
    value NUMBER(10) CONSTRAINT chk_value_range CHECK (value BETWEEN 1 AND 1000)
);

-- CHECK constraint on VARCHAR2 with specific values
CREATE TABLE test_status (
    status VARCHAR2(20) CONSTRAINT chk_status_values CHECK (status IN ('OPEN', 'CLOSED', 'PENDING')),
    code VARCHAR2(10) CONSTRAINT chk_code_len CHECK (LENGTH(code) <= 10)
);

-- CHECK constraint with IS NOT NULL
CREATE TABLE test_not_null (
    name VARCHAR2(100) CONSTRAINT chk_name_not_null CHECK (name IS NOT NULL),
    description VARCHAR2(200) CONSTRAINT chk_desc_len CHECK (LENGTH(description) <= 200)
);

-- CHECK constraint on DATE comparison
CREATE TABLE test_dates (
    event_date DATE CONSTRAINT chk_event_date CHECK (event_date >= SYSDATE),
    end_date DATE CONSTRAINT chk_end_date CHECK (end_date > SYSDATE)
);

-- ============================================
-- COMPLEX INLINE CHECK CONSTRAINTS
-- ============================================

-- CHECK constraint with compound expression
CREATE TABLE test_compound (
    quantity NUMBER(10) CONSTRAINT chk_qty_pos CHECK (quantity >= 0),
    price NUMBER(10,2) CONSTRAINT chk_qty_price CHECK (quantity * price >= 0)
);

-- CHECK constraint with LIKE pattern
CREATE TABLE test_pattern (
    email VARCHAR2(100) CONSTRAINT chk_email_pattern CHECK (email LIKE '%@%.%'),
    phone VARCHAR2(20) CONSTRAINT chk_phone_pattern CHECK (phone LIKE '[0-9]%')
);

-- CHECK constraint with multiple conditions
CREATE TABLE test_multi_condition (
    score NUMBER(3) CONSTRAINT chk_score_range CHECK (score BETWEEN 0 AND 100),
    grade CHAR(1) CONSTRAINT chk_grade_valid CHECK (grade IN ('A', 'B', 'C', 'D', 'F') AND score > 0)
);

-- ============================================
-- CHECK CONSTRAINTS WITH ENABLE/DISABLE
-- ============================================

-- CHECK constraint with ENABLE
CREATE TABLE test_enable (
    level NUMBER(2) CONSTRAINT chk_level_range CHECK (level BETWEEN 1 AND 10) ENABLE,
    rating NUMBER(2) CONSTRAINT chk_rating CHECK (rating >= 0) ENABLE
);

-- CHECK constraint with DISABLE
CREATE TABLE test_disable (
    priority NUMBER(2) CONSTRAINT chk_priority_range CHECK (priority BETWEEN 1 AND 5) DISABLE,
    rank NUMBER(2) CONSTRAINT chk_rank CHECK (rank >= 0) DISABLE
);

-- CHECK constraint with ENABLE VALIDATE
CREATE TABLE test_validate (
    amount NUMBER(10,2) CONSTRAINT chk_amount_pos CHECK (amount >= 0) ENABLE VALIDATE,
    tax NUMBER(10,2) CONSTRAINT chk_tax_pos CHECK (tax >= 0) ENABLE VALIDATE
);

-- CHECK constraint with ENABLE NOVALIDATE
CREATE TABLE test_novalidate (
    discount NUMBER(10,2) CONSTRAINT chk_discount CHECK (discount >= 0) ENABLE NOVALIDATE,
    margin NUMBER(10,2) CONSTRAINT chk_margin CHECK (margin >= 0) ENABLE NOVALIDATE
);

-- CHECK constraint with DISABLE NOVALIDATE
CREATE TABLE test_disable_novalidate (
    weight NUMBER(8,2) CONSTRAINT chk_weight CHECK (weight > 0) DISABLE NOVALIDATE,
    volume NUMBER(8,2) CONSTRAINT chk_volume CHECK (volume > 0) DISABLE NOVALIDATE
);

-- ============================================
-- CHECK CONSTRAINTS WITH RELY/NORELY
-- ============================================

-- CHECK constraint with RELY
CREATE TABLE test_rely (
    code NUMBER(10) CONSTRAINT chk_code_pos CHECK (code > 0) RELY,
    ref_id NUMBER(10) CONSTRAINT chk_ref_id CHECK (ref_id > 0) RELY
);

-- CHECK constraint with NORELY
CREATE TABLE test_norely (
    sequence NUMBER(10) CONSTRAINT chk_seq_pos CHECK (sequence > 0) NORELY,
    counter NUMBER(10) CONSTRAINT chk_counter CHECK (counter >= 0) NORELY
);

-- CHECK constraint with ENABLE RELY
CREATE TABLE test_enable_rely (
    batch_id NUMBER(10) CONSTRAINT chk_batch_id CHECK (batch_id > 0) ENABLE RELY,
    lot_number VARCHAR2(20) CONSTRAINT chk_lot_len CHECK (LENGTH(lot_number) <= 20) ENABLE RELY
);

-- CHECK constraint with DISABLE NORELY
CREATE TABLE test_disable_norely (
    zone_id NUMBER(5) CONSTRAINT chk_zone_id CHECK (zone_id > 0) DISABLE NORELY,
    area_code VARCHAR2(10) CONSTRAINT chk_area_len CHECK (LENGTH(area_code) <= 10) DISABLE NORELY
);

-- ============================================
-- CHECK CONSTRAINTS WITH DEFERRABLE OPTIONS
-- ============================================

-- CHECK constraint with DEFERRABLE INITIALLY DEFERRED
CREATE TABLE test_deferrable_deferred (
    order_id NUMBER(10) CONSTRAINT chk_order_id CHECK (order_id > 0) DEFERRABLE INITIALLY DEFERRED,
    line_item NUMBER(5) CONSTRAINT chk_line_item CHECK (line_item > 0) DEFERRABLE INITIALLY DEFERRED
);

-- CHECK constraint with DEFERRABLE INITIALLY IMMEDIATE
CREATE TABLE test_deferrable_immediate (
    invoice_id NUMBER(10) CONSTRAINT chk_invoice_id CHECK (invoice_id > 0) DEFERRABLE INITIALLY IMMEDIATE,
    payment_status VARCHAR2(20) CONSTRAINT chk_payment_status CHECK (payment_status IN ('PAID', 'PENDING')) DEFERRABLE INITIALLY IMMEDIATE
);

-- CHECK constraint with NOT DEFERRABLE
CREATE TABLE test_not_deferrable (
    ticket_id NUMBER(10) CONSTRAINT chk_ticket_id CHECK (ticket_id > 0) NOT DEFERRABLE,
    issue_date DATE CONSTRAINT chk_issue_date CHECK (issue_date <= SYSDATE) NOT DEFERRABLE
);

-- ============================================
-- CHECK CONSTRAINTS ON DIFFERENT DATA TYPES
-- ============================================

CREATE TABLE test_datatypes_inline (
    col_number NUMBER(10,2) CONSTRAINT chk_number CHECK (col_number >= 0),
    col_varchar2 VARCHAR2(100) CONSTRAINT chk_varchar2 CHECK (LENGTH(col_varchar2) <= 100),
    col_char CHAR(10) CONSTRAINT chk_char CHECK (LENGTH(col_char) = 10),
    col_date DATE CONSTRAINT chk_date_valid CHECK (col_date >= TO_DATE('2000-01-01', 'YYYY-MM-DD')),
    col_timestamp TIMESTAMP CONSTRAINT chk_timestamp_valid CHECK (col_timestamp <= SYSTIMESTAMP),
    col_clob CLOB CONSTRAINT chk_clob CHECK (col_clob IS NOT NULL),
    col_raw RAW(100) CONSTRAINT chk_raw CHECK (LENGTH(col_raw) <= 100),
    col_float FLOAT CONSTRAINT chk_float CHECK (col_float >= 0),
    col_integer INTEGER CONSTRAINT chk_integer CHECK (col_integer >= 0),
    col_nvarchar2 NVARCHAR2(100) CONSTRAINT chk_nvarchar2 CHECK (LENGTH(col_nvarchar2) <= 100),
    col_nchar NCHAR(10) CONSTRAINT chk_nchar CHECK (LENGTH(col_nchar) = 10)
);

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- CHECK constraint with complex expression
CREATE TABLE test_complex (
    score NUMBER(3) CONSTRAINT chk_score_complex CHECK (score >= 0 AND MOD(score, 2) = 0),
    rating VARCHAR2(20) CONSTRAINT chk_rating_complex CHECK (rating IN ('HIGH', 'MEDIUM', 'LOW') AND LENGTH(rating) > 3)
);

-- CHECK constraint with pattern matching
CREATE TABLE test_pattern_match (
    zip_code VARCHAR2(10) CONSTRAINT chk_zip_format CHECK (REGEXP_LIKE(zip_code, '^[0-9]{5}(-[0-9]{4})?$')),
    serial_number VARCHAR2(20) CONSTRAINT chk_serial_format CHECK (REGEXP_LIKE(serial_number, '^[A-Z0-9]+$'))
);

-- CHECK constraint with subquery (Note: Oracle allows subqueries in CHECK constraints in some versions)
CREATE TABLE test_subquery (
    dept_id NUMBER(10) CONSTRAINT chk_dept_id_exists CHECK (dept_id IN (SELECT dept_id FROM departments)),
    emp_count NUMBER(5) CONSTRAINT chk_emp_count CHECK (emp_count >= 0)
);
