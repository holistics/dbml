Table "customers" {
  "cust_id" NUMBER(10) [default: 0]
  "cust_name" VARCHAR2(100) [default: 'Unknown']
  "email" VARCHAR2(100) [default: 'noemail@example.com']
  "phone" VARCHAR2(20) [default: 'N/A']
  "address" VARCHAR2(200) [default: 'Unknown Address']
  "status" VARCHAR2(20) [default: 'ACTIVE']
  "reg_date" DATE [default: `SYSDATE`]
  "last_login" TIMESTAMP [default: `SYSTIMESTAMP`]
}

Table "inventory" {
  "item_id" NUMBER(10) [default: 1]
  "item_name" VARCHAR2(200) [default: 'Item']
  "price" NUMBER(10,2) [default: 0]
  "category" VARCHAR2(50) [default: 'Misc']
  "sku" VARCHAR2(50) [default: 'SKU000']
  "weight" NUMBER(8,2) [default: 0]
  "stock_level" NUMBER(10) [default: 0]
  "reorder_level" NUMBER(10) [default: 10]
}

Table "shipments" {
  "ship_id" NUMBER(10) [default: `test_seq.NEXTVAL`]
  "customer_id" NUMBER(10) [default: 1]
  "ship_date" DATE [default: `SYSDATE`]
  "total_amount" NUMBER(12,2) [default: 0]
  "tracking_number" VARCHAR2(50) [default: `SYS_GUID()`]
  "carrier" VARCHAR2(100) [default: 'UPS']
  "priority" NUMBER(2) [default: 1]
  "notes" VARCHAR2(4000) [default: 'No notes']
}

Table "departments" {
  "dept_id" NUMBER(10) [default: 100]
  "dept_name" VARCHAR2(100) [default: 'General']
  "manager_id" NUMBER(10) [default: 0]
  "budget" NUMBER(12,2) [default: 10000]
  "location" VARCHAR2(50) [default: 'HQ']
  "established_date" DATE [default: `SYSDATE`]
}

Table "suppliers" {
  "supp_id" NUMBER(10) [default: 500]
  "supp_name" VARCHAR2(100) [default: 'Supplier']
  "contact" VARCHAR2(100) [default: 'Contact']
  "ssn" VARCHAR2(11) [default: '000-00-0000']
  "badge_number" VARCHAR2(10) [default: 'BADGE000']
  "credit_limit" NUMBER(10,2) [default: 5000]
}

Table "test_datatypes" {
  "col_number" NUMBER(10,2) [default: 42]
  "col_varchar2" VARCHAR2(100) [default: 'Default Text']
  "col_char" CHAR(10) [default: 'CHARDEF   ']
  "col_date" DATE [default: `SYSDATE`]
  "col_timestamp" TIMESTAMP [default: `SYSTIMESTAMP`]
  "col_clob" CLOB [default: `EMPTY_CLOB()`]
  "col_raw" RAW(100) [default: `HEXTORAW('00')`]
  "col_float" FLOAT [default: 3.14]
  "col_integer" INTEGER [default: 100]
  "col_nvarchar2" NVARCHAR2(100) [default: `N'Default National'`]
  "col_nchar" NCHAR(10) [default: `N'NCHARDEF  '`]
}

Table "test_basic_num" {
  "id" NUMBER(10) [default: 0]
  "value" NUMBER(10) [default: 100]
}

Table "test_basic_varchar" {
  "name" VARCHAR2(100) [default: 'Unknown']
  "code" VARCHAR2(10) [default: 'CODE']
}

Table "test_basic_date" {
  "event_date" DATE [default: `SYSDATE`]
  "end_date" DATE [default: `SYSDATE + 1`]
}

Table "test_expr_sysdate" {
  "created_at" DATE [default: `SYSDATE`]
  "updated_at" DATE [default: `SYSDATE`]
}

Table "test_expr_user" {
  "created_by" VARCHAR2(30) [default: `USER`]
  "modified_by" VARCHAR2(30) [default: `USER`]
}

Table "test_expr_guid" {
  "unique_id" VARCHAR2(32) [default: `SYS_GUID()`]
  "session_id" VARCHAR2(32) [default: `SYS_GUID()`]
}

Table "test_expr_seq" {
  "seq_id" NUMBER(10) [default: `test_seq.NEXTVAL`]
  "auto_id" NUMBER(10) [default: `test_seq.NEXTVAL`]
}

Table "test_expr_arith" {
  "base_value" NUMBER(10) [default: 1000]
  "calc_value" NUMBER(10) [default: `1000 + 500`]
}

Table "test_on_null_basic" {
  "email" VARCHAR2(100) [default: 'noemail@example.com']
  "phone" VARCHAR2(20) [default: 'N/A']
}

Table "test_on_null_num" {
  "quantity" NUMBER(10) [default: 0]
  "discount" NUMBER(5,2) [default: 0]
}

Table "test_on_null_date" {
  "start_date" DATE [default: `SYSDATE`]
  "end_date" DATE [default: `SYSDATE + 7`]
}

Table "test_default_not_null" {
  "status" VARCHAR2(20) [not null, default: 'ACTIVE']
  "priority" NUMBER(2) [not null, default: 1]
}

Table "test_on_null_not_null" {
  "name" VARCHAR2(100) [not null, default: 'Unknown']
  "code" VARCHAR2(10) [not null, default: 'CODE']
}

Table "test_nn_enable" {
  "level" NUMBER(2) [not null, default: 1]
  "rating" NUMBER(2) [not null, default: 5]
}

Table "test_nn_disable" {
  "rank" NUMBER(2) [not null, default: 10]
  "score" NUMBER(3) [not null, default: 0]
}

Table "test_nn_validate" {
  "amount" NUMBER(10,2) [not null, default: 0]
  "tax" NUMBER(10,2) [not null, default: 0]
}

Table "test_nn_novalidate" {
  "discount" NUMBER(5,2) [not null, default: 0]
  "margin" NUMBER(5,2) [not null, default: 0.1]
}

Table "test_nn_disable_noval" {
  "weight" NUMBER(8,2) [not null, default: 0]
  "volume" NUMBER(8,2) [not null, default: 0]
}

Table "test_nn_rely" {
  "code" NUMBER(10) [not null, default: 100]
  "ref_id" NUMBER(10) [not null, default: 200]
}

Table "test_nn_norely" {
  "sequence" NUMBER(10) [not null, default: 1]
  "counter" NUMBER(10) [not null, default: 0]
}

Table "test_nn_enable_rely" {
  "batch_id" NUMBER(10) [not null, default: 500]
  "lot_number" VARCHAR2(20) [not null, default: 'LOT']
}

Table "test_nn_disable_norely" {
  "zone_id" NUMBER(5) [not null, default: 1]
  "area_code" VARCHAR2(10) [not null, default: 'AREA']
}

Table "test_nn_defer_deferred" {
  "order_id" NUMBER(10) [not null, default: 1000]
  "line_item" NUMBER(5) [not null, default: 1]
}

Table "test_nn_defer_immediate" {
  "invoice_id" NUMBER(10) [not null, default: 2000]
  "payment_status" VARCHAR2(20) [not null, default: 'PENDING']
}

Table "test_nn_not_defer" {
  "ticket_id" NUMBER(10) [not null, default: 3000]
  "issue_date" DATE [not null, default: `SYSDATE`]
}

Table "test_datatypes_inline" {
  "col_number" NUMBER(10,2) [default: 0]
  "col_varchar2" VARCHAR2(100) [default: 'Text']
  "col_char" CHAR(10) [default: 'CHAR      ']
  "col_date" DATE [default: `SYSDATE`]
  "col_timestamp" TIMESTAMP [default: `SYSTIMESTAMP`]
  "col_clob" CLOB [default: 'CLOB Default']
  "col_raw" RAW(100) [default: `HEXTORAW('0000')`]
  "col_float" FLOAT [default: 1.23]
  "col_integer" INTEGER [default: 42]
  "col_nvarchar2" NVARCHAR2(100) [default: `N'National Text'`]
  "col_nchar" NCHAR(10) [default: `N'NCHAR     '`]
}

Table "test_complex_expr" {
  "full_name" VARCHAR2(200) [default: `USER || '_USER'`]
  "calc_field" NUMBER(10) [default: `100 * 2`]
}

Table "test_long_default" {
  "description" VARCHAR2(4000) [default: 'This is a very long default value for testing purposes, exceeding typical lengths to check parser limits and storage implications in Oracle SQL']
  "comments" VARCHAR2(4000) [default: 'Another long default string to test maximum lengths and handling in table creation statements']
}
