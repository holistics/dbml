Table "customers" {
  "cust_id" NUMBER(10)
  "cust_name" VARCHAR2(100) [not null]
  "email" VARCHAR2(100) [not null]
  "phone" VARCHAR2(20)
}

Table "inventory" {
  "item_id" NUMBER(10)
  "item_name" VARCHAR2(200) [not null]
  "price" NUMBER(10,2) [not null]
  "category" VARCHAR2(50) [not null]
  "manufacturer" VARCHAR2(100) [not null]
  "sku" VARCHAR2(50) [not null]
}

Table "shipments" {
  "ship_id" NUMBER(10)
  "customer_id" NUMBER(10) [not null]
  "ship_date" DATE [not null]
  "total_amount" NUMBER(12,2) [not null]
}

Table "departments" {
  "dept_id" NUMBER(10) [not null]
  "dept_name" VARCHAR2(100) [not null]
  "manager_id" NUMBER(10)
  "status" VARCHAR2(20)
}

Table "suppliers" {
  "supp_id" NUMBER(10)
  "supp_name" VARCHAR2(100) [not null]
  "contact" VARCHAR2(100)
  "ssn" VARCHAR2(11)
  "badge_number" VARCHAR2(10)
}
