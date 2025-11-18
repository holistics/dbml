Table "customers" {
  "cust_id" NUMBER(10) [check: `cust_id > 0`]
  "cust_name" VARCHAR2(100) [check: `LENGTH(cust_name) <= 100`]
  "email" VARCHAR2(100) [check: `email LIKE '%@%.%'`]
  "phone" VARCHAR2(20) [check: `LENGTH(phone) >= 10`]
  "address" VARCHAR2(200) [check: `address IS NOT NULL`]
  "status" VARCHAR2(20) [check: `status IN ('ACTIVE', 'INACTIVE')`]
  "reg_date" DATE [check: `reg_date >= TO_DATE('2000-01-01', 'YYYY-MM-DD')`]
  "last_login" TIMESTAMP [check: `last_login <= SYSTIMESTAMP`, check: `last_login >= SYSTIMESTAMP`]
  "last_login_2" TIMESTAMP [check: `last_login_2 <= SYSTIMESTAMP`, check: `last_login_2 >= SYSTIMESTAMP`]
  "last_login_3" TIMESTAMP [check: `last_login_3 <= SYSTIMESTAMP`, check: `last_login_3 >= SYSTIMESTAMP`]
}

Table "inventory" {
  "item_id" NUMBER(10) [check: `item_id > 0`]
  "item_name" VARCHAR2(200) [check: `item_name IS NOT NULL`]
  "price" NUMBER(10,2) [check: `price >= 0`]
  "category" VARCHAR2(50) [check: `category IN ('ELECTRONICS', 'CLOTHING', 'BOOKS')`]
  "sku" VARCHAR2(50) [check: `LENGTH(sku) <= 50`]
  "weight" NUMBER(8,2) [check: `weight > 0`]
  "stock_level" NUMBER(10) [check: `stock_level >= 0`]
  "reorder_level" NUMBER(10) [check: `reorder_level >= 0`]
}

Table "shipments" {
  "ship_id" NUMBER(10) [check: `ship_id > 0`]
  "customer_id" NUMBER(10) [check: `customer_id > 0`]
  "ship_date" DATE [check: `ship_date >= TRUNC(SYSDATE)`]
  "total_amount" NUMBER(12,2) [check: `total_amount >= 0`]
  "tracking_number" VARCHAR2(50) [check: `LENGTH(tracking_number) <= 50`]
  "carrier" VARCHAR2(100) [check: `carrier IS NOT NULL`]
  "priority" NUMBER(2) [check: `priority BETWEEN 1 AND 5`]
  "notes" VARCHAR2(4000) [check: `LENGTH(notes) <= 4000`]
}

Table "departments" {
  "dept_id" NUMBER(10) [check: `dept_id > 0`]
  "dept_name" VARCHAR2(100) [check: `dept_name IS NOT NULL`]
  "manager_id" NUMBER(10) [check: `manager_id > 0`]
  "budget" NUMBER(12,2) [check: `budget >= 0`]
  "location" VARCHAR2(50) [check: `location IS NOT NULL`]
  "established_date" DATE [check: `established_date <= SYSDATE`]
}

Table "suppliers" {
  "supp_id" NUMBER(10) [check: `supp_id > 0`]
  "supp_name" VARCHAR2(100) [check: `supp_name IS NOT NULL`]
  "contact" VARCHAR2(100) [check: `LENGTH(contact) <= 100`]
  "ssn" VARCHAR2(11) [check: `ssn LIKE '___-__-____'`]
  "badge_number" VARCHAR2(10) [check: `LENGTH(badge_number) <= 10`]
  "credit_limit" NUMBER(10,2) [check: `credit_limit >= 0`]
}

Table "test_datatypes" {
  "col_number" NUMBER(10,2) [check: `col_number >= 0`]
  "col_varchar2" VARCHAR2(100) [check: `LENGTH(col_varchar2) <= 100`]
  "col_char" CHAR(10) [check: `LENGTH(col_char) = 10`]
  "col_date" DATE [check: `col_date >= TO_DATE('2000-01-01', 'YYYY-MM-DD')`]
  "col_timestamp" TIMESTAMP [check: `col_timestamp <= SYSTIMESTAMP`]
  "col_clob" CLOB [check: `col_clob IS NOT NULL`]
  "col_raw" RAW(100) [check: `LENGTH(col_raw) <= 100`]
  "col_float" FLOAT [check: `col_float >= 0`]
  "col_integer" INTEGER [check: `col_integer >= 0`]
  "col_nvarchar2" NVARCHAR2(100) [check: `LENGTH(col_nvarchar2) <= 100`]
  "col_nchar" NCHAR(10) [check: `LENGTH(col_nchar) = 10`]
}

Table "test_basic" {
  "id" NUMBER(10) [check: `id > 0`]
  "value" NUMBER(10) [check: `value BETWEEN 1 AND 1000`]
}

Table "test_status" {
  "status" VARCHAR2(20) [check: `status IN ('OPEN', 'CLOSED', 'PENDING')`]
  "code" VARCHAR2(10) [check: `LENGTH(code) <= 10`]
}

Table "test_not_null" {
  "name" VARCHAR2(100) [check: `name IS NOT NULL`]
  "description" VARCHAR2(200) [check: `LENGTH(description) <= 200`]
}

Table "test_dates" {
  "event_date" DATE [check: `event_date >= SYSDATE`]
  "end_date" DATE [check: `end_date > SYSDATE`]
}

Table "test_compound" {
  "quantity" NUMBER(10) [check: `quantity >= 0`]
  "price" NUMBER(10,2) [check: `quantity * price >= 0`]
}

Table "test_pattern" {
  "email" VARCHAR2(100) [check: `email LIKE '%@%.%'`]
  "phone" VARCHAR2(20) [check: `phone LIKE '[0-9]%'`]
}

Table "test_multi_condition" {
  "score" NUMBER(3) [check: `score BETWEEN 0 AND 100`]
  "grade" CHAR(1) [check: `grade IN ('A', 'B', 'C', 'D', 'F') AND score > 0`]
}

Table "test_enable" {
  "level" NUMBER(2) [check: `level BETWEEN 1 AND 10`]
  "rating" NUMBER(2) [check: `rating >= 0`]
}

Table "test_disable" {
  "priority" NUMBER(2) [check: `priority BETWEEN 1 AND 5`]
  "rank" NUMBER(2) [check: `rank >= 0`]
}

Table "test_validate" {
  "amount" NUMBER(10,2) [check: `amount >= 0`]
  "tax" NUMBER(10,2) [check: `tax >= 0`]
}

Table "test_novalidate" {
  "discount" NUMBER(10,2) [check: `discount >= 0`]
  "margin" NUMBER(10,2) [check: `margin >= 0`]
}

Table "test_disable_novalidate" {
  "weight" NUMBER(8,2) [check: `weight > 0`]
  "volume" NUMBER(8,2) [check: `volume > 0`]
}

Table "test_rely" {
  "code" NUMBER(10) [check: `code > 0`]
  "ref_id" NUMBER(10) [check: `ref_id > 0`]
}

Table "test_norely" {
  "sequence" NUMBER(10) [check: `sequence > 0`]
  "counter" NUMBER(10) [check: `counter >= 0`]
}

Table "test_enable_rely" {
  "batch_id" NUMBER(10) [check: `batch_id > 0`]
  "lot_number" VARCHAR2(20) [check: `LENGTH(lot_number) <= 20`]
}

Table "test_disable_norely" {
  "zone_id" NUMBER(5) [check: `zone_id > 0`]
  "area_code" VARCHAR2(10) [check: `LENGTH(area_code) <= 10`]
}

Table "test_deferrable_deferred" {
  "order_id" NUMBER(10) [check: `order_id > 0`]
  "line_item" NUMBER(5) [check: `line_item > 0`]
}

Table "test_deferrable_immediate" {
  "invoice_id" NUMBER(10) [check: `invoice_id > 0`]
  "payment_status" VARCHAR2(20) [check: `payment_status IN ('PAID', 'PENDING')`]
}

Table "test_not_deferrable" {
  "ticket_id" NUMBER(10) [check: `ticket_id > 0`]
  "issue_date" DATE [check: `issue_date <= SYSDATE`]
}

Table "test_datatypes_inline" {
  "col_number" NUMBER(10,2) [check: `col_number >= 0`]
  "col_varchar2" VARCHAR2(100) [check: `LENGTH(col_varchar2) <= 100`]
  "col_char" CHAR(10) [check: `LENGTH(col_char) = 10`]
  "col_date" DATE [check: `col_date >= TO_DATE('2000-01-01', 'YYYY-MM-DD')`]
  "col_timestamp" TIMESTAMP [check: `col_timestamp <= SYSTIMESTAMP`]
  "col_clob" CLOB [check: `col_clob IS NOT NULL`]
  "col_raw" RAW(100) [check: `LENGTH(col_raw) <= 100`]
  "col_float" FLOAT [check: `col_float >= 0`]
  "col_integer" INTEGER [check: `col_integer >= 0`]
  "col_nvarchar2" NVARCHAR2(100) [check: `LENGTH(col_nvarchar2) <= 100`]
  "col_nchar" NCHAR(10) [check: `LENGTH(col_nchar) = 10`]
}

Table "test_complex" {
  "score" NUMBER(3) [check: `score >= 0 AND MOD(score, 2) = 0`]
  "rating" VARCHAR2(20) [check: `rating IN ('HIGH', 'MEDIUM', 'LOW') AND LENGTH(rating) > 3`]
}

Table "test_pattern_match" {
  "zip_code" VARCHAR2(10) [check: `REGEXP_LIKE(zip_code, '^[0-9]{5}(-[0-9]{4})?$')`]
  "serial_number" VARCHAR2(20) [check: `REGEXP_LIKE(serial_number, '^[A-Z0-9]+$')`]
}

Table "test_subquery" {
  "dept_id" NUMBER(10) [check: `dept_id IN (SELECT dept_id FROM departments)`]
  "emp_count" NUMBER(5) [check: `emp_count >= 0`]
}
