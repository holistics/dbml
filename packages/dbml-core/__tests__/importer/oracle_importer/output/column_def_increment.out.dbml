Table "customers" {
  "cust_id" NUMBER [increment]
  "cust_name" VARCHAR2(100) [default: 'Unknown']
  "email" VARCHAR2(100) [default: 'noemail@example.com']
  "phone" VARCHAR2(20) [default: 'N/A']
}

Table "inventory" {
  "item_id" NUMBER [increment]
  "item_name" VARCHAR2(200) [default: 'Default Item']
  "price" NUMBER(10,2) [default: 0]
  "category" VARCHAR2(50) [default: 'Misc']
}

Table "shipments" {
  "ship_id" NUMBER [increment]
  "customer_id" NUMBER(10) [default: 1]
  "ship_date" DATE [default: `SYSDATE`]
  "total_amount" NUMBER(12,2) [default: 0]
}

Table "departments" {
  "dept_id" NUMBER [increment]
  "dept_name" VARCHAR2(100) [default: 'General']
  "manager_id" NUMBER(10) [default: 0]
  "budget" NUMBER(12,2) [default: 10000]
}

Table "suppliers" {
  "supp_id" NUMBER [increment]
  "supp_name" VARCHAR2(100) [default: 'Anonymous']
  "contact" VARCHAR2(100) [default: 'Contact']
  "credit_limit" NUMBER(10,2) [default: 5000]
}

Table "test_datatypes" {
  "col_number" NUMBER [increment]
  "col_varchar2" VARCHAR2(100) [default: 'Default Text']
  "col_char" CHAR(10) [default: 'DEFAULT   ']
  "col_date" DATE [default: `SYSDATE`]
}

Table "test_basic" {
  "id" NUMBER [increment]
  "value" NUMBER(10) [default: 100]
}

Table "test_status" {
  "status_id" NUMBER [increment]
  "status" VARCHAR2(20) [default: 'OPEN']
}

Table "test_not_null" {
  "record_id" NUMBER [not null, increment]
  "description" VARCHAR2(200) [not null, default: 'No description']
}

Table "test_start_with" {
  "order_id" NUMBER [increment]
  "order_code" VARCHAR2(20) [default: 'ORD000']
}

Table "test_increment" {
  "ticket_id" NUMBER [increment]
  "ticket_type" VARCHAR2(20) [default: 'STANDARD']
}

Table "test_maxvalue" {
  "ref_id" NUMBER [increment]
  "ref_name" VARCHAR2(100) [default: 'Reference']
}

Table "test_minvalue" {
  "batch_id" NUMBER [increment]
  "batch_name" VARCHAR2(50) [default: 'Batch']
}
