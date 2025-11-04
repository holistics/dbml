Table "customers" {
  "cust_id" NUMBER(10) [unique]
  "cust_name" VARCHAR2(100) [unique]
  "email" VARCHAR2(100) [unique]
  "phone" VARCHAR2(20) [unique]
}

Table "inventory" {
  "item_id" NUMBER(10) [unique]
  "item_name" VARCHAR2(200) [unique]
  "price" NUMBER(10,2)
  "sku" VARCHAR2(50) [unique]
}

Table "shipments" {
  "ship_id" NUMBER(10) [unique]
  "customer_id" NUMBER(10)
  "ship_date" DATE [unique]
  "tracking_number" VARCHAR2(50) [unique]
}

Table "departments" {
  "dept_id" NUMBER(10) [unique]
  "dept_name" VARCHAR2(100) [unique]
  "manager_id" NUMBER(10) [unique]
  "budget" NUMBER(12,2)
}

Table "suppliers" {
  "supp_id" NUMBER(10) [unique]
  "supp_name" VARCHAR2(100) [unique]
  "contact" VARCHAR2(100) [unique]
  "ssn" VARCHAR2(11) [unique]
}

Table "test_datatypes" {
  "col_number" NUMBER(10,2) [unique]
  "col_varchar2" VARCHAR2(100) [unique]
  "col_char" CHAR(10) [unique]
  "col_date" DATE [unique]
  "col_timestamp" TIMESTAMP [unique]
  "col_clob" CLOB [unique]
  "col_raw" RAW(100) [unique]
  "col_float" FLOAT [unique]
  "col_integer" INTEGER [unique]
  "col_nvarchar2" NVARCHAR2(100) [unique]
  "col_nchar" NCHAR(10) [unique]
}

Table "test_basic" {
  "id" NUMBER(10) [unique]
  "value" NUMBER(10) [unique]
}

Table "test_named" {
  "code" VARCHAR2(20) [unique]
  "ref_id" NUMBER(10) [unique]
}

Table "test_status" {
  "status" VARCHAR2(20) [unique]
  "status_code" VARCHAR2(10) [unique]
}

Table "test_dates" {
  "event_date" DATE [unique]
  "end_date" DATE [unique]
}

Table "test_enable" {
  "level" NUMBER(2) [unique]
  "rating" NUMBER(2) [unique]
}

Table "test_disable" {
  "priority" NUMBER(2) [unique]
  "rank" NUMBER(2) [unique]
}

Table "test_validate" {
  "amount" NUMBER(10,2) [unique]
  "tax" NUMBER(10,2) [unique]
}

Table "test_novalidate" {
  "discount" NUMBER(10,2) [unique]
  "margin" NUMBER(10,2) [unique]
}

Table "test_disable_novalidate" {
  "weight" NUMBER(8,2) [unique]
  "volume" NUMBER(8,2) [unique]
}

Table "test_rely" {
  "code" NUMBER(10) [unique]
  "ref_id" NUMBER(10) [unique]
}

Table "test_norely" {
  "sequence" NUMBER(10) [unique]
  "counter" NUMBER(10) [unique]
}

Table "test_enable_rely" {
  "batch_id" NUMBER(10) [unique]
  "lot_number" VARCHAR2(20) [unique]
}

Table "test_disable_norely" {
  "zone_id" NUMBER(5) [unique]
  "area_code" VARCHAR2(10) [unique]
}

Table "test_deferrable_deferred" {
  "order_id" NUMBER(10) [unique]
  "line_item" NUMBER(5) [unique]
}

Table "test_deferrable_immediate" {
  "invoice_id" NUMBER(10) [unique]
  "payment_status" VARCHAR2(20) [unique]
}

Table "test_not_deferrable" {
  "ticket_id" NUMBER(10) [unique]
  "issue_date" DATE [unique]
}

Table "test_datatypes_inline" {
  "col_number" NUMBER(10,2) [unique]
  "col_varchar2" VARCHAR2(100) [unique]
  "col_char" CHAR(10) [unique]
  "col_date" DATE [unique]
  "col_timestamp" TIMESTAMP [unique]
  "col_clob" CLOB [unique]
  "col_raw" RAW(100) [unique]
  "col_float" FLOAT [unique]
  "col_integer" INTEGER [unique]
  "col_nvarchar2" NVARCHAR2(100) [unique]
  "col_nchar" NCHAR(10) [unique]
}

Table "test_long_name" {
  "identifier" NUMBER(10) [unique]
  "record_code" VARCHAR2(20) [unique]
}

Table "test_complex" {
  "score" NUMBER(3) [unique]
  "rating" VARCHAR2(20) [unique]
}
