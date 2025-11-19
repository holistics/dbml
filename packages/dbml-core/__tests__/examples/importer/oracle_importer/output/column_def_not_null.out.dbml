Table "customers" {
  "cust_id" NUMBER(10) [not null]
  "cust_name" VARCHAR2(100) [not null]
  "email" VARCHAR2(100) [not null]
  "phone" VARCHAR2(20) [not null]
}

Table "inventory" {
  "item_id" NUMBER(10) [not null]
  "item_name" VARCHAR2(200) [not null]
  "price" NUMBER(10,2) [not null]
  "category" VARCHAR2(50) [not null]
}

Table "shipments" {
  "ship_id" NUMBER(10) [not null]
  "customer_id" NUMBER(10) [not null]
  "ship_date" DATE [not null]
  "total_amount" NUMBER(12,2) [not null]
}

Table "departments" {
  "dept_id" NUMBER(10) [not null]
  "dept_name" VARCHAR2(100) [not null]
  "manager_id" NUMBER(10) [not null]
  "budget" NUMBER(12,2) [not null]
}

Table "suppliers" {
  "supp_id" NUMBER(10) [not null]
  "supp_name" VARCHAR2(100) [not null]
  "contact" VARCHAR2(100) [not null]
  "credit_limit" NUMBER(10,2) [not null]
}

Table "test_datatypes" {
  "col_number" NUMBER(10,2) [not null]
  "col_varchar2" VARCHAR2(100) [not null]
  "col_char" CHAR(10) [not null]
  "col_date" DATE [not null]
  "col_timestamp" TIMESTAMP [not null]
  "col_clob" CLOB [not null]
  "col_raw" RAW(100) [not null]
  "col_float" FLOAT [not null]
  "col_integer" INTEGER [not null]
  "col_nvarchar2" NVARCHAR2(100) [not null]
  "col_nchar" NCHAR(10) [not null]
}

Table "test_basic" {
  "id" NUMBER(10) [not null]
  "value" NUMBER(10) [not null]
}

Table "test_status" {
  "status" VARCHAR2(20) [not null]
  "code" VARCHAR2(10) [not null]
}

Table "test_named" {
  "record_id" NUMBER(10) [not null]
  "description" VARCHAR2(200) [not null]
}

Table "test_dates" {
  "event_date" DATE [not null]
  "end_date" DATE [not null]
}

Table "test_enable" {
  "level" NUMBER(2) [not null]
  "rating" NUMBER(2) [not null]
}

Table "test_disable" {
  "priority" NUMBER(2) [not null]
  "rank" NUMBER(2) [not null]
}

Table "test_validate" {
  "amount" NUMBER(10,2) [not null]
  "tax" NUMBER(10,2) [not null]
}

Table "test_novalidate" {
  "discount" NUMBER(10,2) [not null]
  "margin" NUMBER(10,2) [not null]
}

Table "test_disable_novalidate" {
  "weight" NUMBER(8,2) [not null]
  "volume" NUMBER(8,2) [not null]
}

Table "test_rely" {
  "code" NUMBER(10) [not null]
  "ref_id" NUMBER(10) [not null]
}

Table "test_norely" {
  "sequence" NUMBER(10) [not null]
  "counter" NUMBER(10) [not null]
}

Table "test_enable_rely" {
  "batch_id" NUMBER(10) [not null]
  "lot_number" VARCHAR2(20) [not null]
}

Table "test_disable_norely" {
  "zone_id" NUMBER(5) [not null]
  "area_code" VARCHAR2(10) [not null]
}

Table "test_deferrable_deferred" {
  "order_id" NUMBER(10) [not null]
  "line_item" NUMBER(5) [not null]
}

Table "test_deferrable_immediate" {
  "invoice_id" NUMBER(10) [not null]
  "payment_status" VARCHAR2(20) [not null]
}

Table "test_not_deferrable" {
  "ticket_id" NUMBER(10) [not null]
  "issue_date" DATE [not null]
}

Table "test_datatypes_inline" {
  "col_number" NUMBER(10,2) [not null]
  "col_varchar2" VARCHAR2(100) [not null]
  "col_char" CHAR(10) [not null]
  "col_date" DATE [not null]
  "col_timestamp" TIMESTAMP [not null]
  "col_clob" CLOB [not null]
  "col_raw" RAW(100) [not null]
  "col_float" FLOAT [not null]
  "col_integer" INTEGER [not null]
  "col_nvarchar2" NVARCHAR2(100) [not null]
  "col_nchar" NCHAR(10) [not null]
}

Table "test_long_name" {
  "identifier" NUMBER(10) [not null]
  "record_code" VARCHAR2(20) [not null]
}

Table "test_complex" {
  "score" NUMBER(3) [not null]
  "rating" VARCHAR2(20) [not null]
}
