Table "customers" {
  "cust_id" NUMBER(10)
  "cust_name" VARCHAR2(100)
  "email" VARCHAR2(100)
  "phone" VARCHAR2(20)
  "status" VARCHAR2(20)
  "reg_date" DATE
  "region" VARCHAR2(50)
  "credit_limit" NUMBER(10,2)

  Indexes {
    cust_id [name: "idx_cust_id"]
    email [unique, name: "idx_cust_email"]
    status [type: bitmap, name: "idx_cust_status"]
    `UPPER(cust_name)` [name: "idx_cust_name_upper"]
    `LOWER(email)` [unique, name: "idx_cust_email_lower"]
    cust_id [name: "idx_very_long_index_name_for_testing_parser_limits"]
    cust_id [type: bitmap, name: "idx_cust_id_bitmap"]
    `TO_CHAR(reg_date, 'YYYYMM') || cust_name` [name: "idx_cust_complex"]
  }
}

Table "inventory" {
  "item_id" NUMBER(10)
  "item_name" VARCHAR2(200)
  "price" NUMBER(10,2)
  "category" VARCHAR2(50)
  "sku" VARCHAR2(50)
  "stock_level" NUMBER(10)
  "warehouse_id" NUMBER(10)
  "supplier_id" NUMBER(10)

  Indexes {
    (item_name, price) [name: "idx_inv_item_price"]
    (category, stock_level) [type: bitmap, name: "idx_inv_category_stock"]
    (`UPPER(item_name)`, `price * 1.1`) [name: "idx_inv_name_price"]
    `ORA_HASH(item_name)` [name: "idx_inv_hash_like"]
  }
}

Table "shipments" {
  "ship_id" NUMBER(10)
  "customer_id" NUMBER(10)
  "ship_date" DATE
  "total_amount" NUMBER(12,2)
  "tracking_number" VARCHAR2(50)
  "carrier" VARCHAR2(100)
  "priority" NUMBER(2)

  Indexes {
    (customer_id, ship_date) [unique, name: "idx_ship_cust_date"]
    customer_id [name: "idx_ship_nullable"]
  }
}

Table "departments" {
  "dept_id" NUMBER(10)
  "dept_name" VARCHAR2(100)
  "manager_id" NUMBER(10)
  "location" VARCHAR2(50)
}

Table "suppliers" {
  "supp_id" NUMBER(10)
  "supp_name" VARCHAR2(100)
  "contact" VARCHAR2(100)
  "city" VARCHAR2(50)
}

Table "test_datatypes" {
  "col_number" NUMBER(10,2)
  "col_varchar2" VARCHAR2(100)
  "col_char" CHAR(10)
  "col_date" DATE
  "col_timestamp" TIMESTAMP
  "col_clob" CLOB
  "col_raw" RAW(100)
  "col_float" FLOAT
  "col_integer" INTEGER
  "col_nvarchar2" NVARCHAR2(100)
  "col_nchar" NCHAR(10)

  Indexes {
    (col_number, col_varchar2, col_date) [name: "idx_dt_mixed"]
  }
}
