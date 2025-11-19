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
    col_number [pk, name: "pk_number"]
    col_varchar2 [pk, name: "pk_varchar2"]
    col_char [pk, name: "pk_char"]
    col_date [pk, name: "pk_date"]
    col_timestamp [pk, name: "pk_timestamp"]
    col_clob [pk, name: "pk_clob"]
    col_raw [pk, name: "pk_raw"]
    col_float [pk, name: "pk_float"]
    col_integer [pk, name: "pk_integer"]
    col_nvarchar2 [pk, name: "pk_nvarchar2"]
    col_nchar [pk, name: "pk_nchar"]
  }
}

Table "order_details" {
  "order_id" NUMBER(10)
  "item_id" NUMBER(10)
  "quantity" NUMBER(10)
  "order_date" DATE

  Indexes {
    (order_id, item_id) [pk, name: "pk_order_details"]
  }
}

Table "reports" {
  "report_id" NUMBER(10)
  "report_name" VARCHAR2(100)
  "report_date" DATE
  "status" VARCHAR2(20)

  Indexes {
    report_id [pk, name: "pk_very_long_constraint_name_for_testing_parser_limits"]
  }
}

Table "sales" {
  "sale_id" NUMBER(10)
  "sale_date" DATE
  "amount" NUMBER(12,2)

  Indexes {
    sale_id [pk, name: "pk_sale"]
  }
}

Table "accounts" {
  "account_id" NUMBER(10)
  "account_number" VARCHAR2(20)
  "balance" NUMBER(12,2)

  Indexes {
    account_id [pk, name: "pk_account"]
  }
}
