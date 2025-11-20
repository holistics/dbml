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
    col_number [unique, name: "uk_number"]
    col_varchar2 [unique, name: "uk_varchar2"]
    col_char [unique, name: "uk_char"]
    col_date [unique, name: "uk_date"]
    col_timestamp [unique, name: "uk_timestamp"]
    col_clob [unique, name: "uk_clob"]
    col_raw [unique, name: "uk_raw"]
    col_float [unique, name: "uk_float"]
    col_integer [unique, name: "uk_integer"]
    col_nvarchar2 [unique, name: "uk_nvarchar2"]
    col_nchar [unique, name: "uk_nchar"]
  }
}

Table "order_details" {
  "order_id" NUMBER(10)
  "item_id" NUMBER(10)
  "quantity" NUMBER(10)
  "order_ref" VARCHAR2(20)

  Indexes {
    (order_id, item_id) [unique, name: "uk_order_ref"]
  }
}

Table "reports" {
  "report_id" NUMBER(10)
  "report_name" VARCHAR2(100)
  "report_date" DATE
  "report_code" VARCHAR2(20)

  Indexes {
    report_code [unique, name: "uk_very_long_constraint_name_for_testing_parser_limits"]
  }
}

Table "sales" {
  "sale_id" NUMBER(10)
  "sale_date" DATE
  "sale_code" VARCHAR2(20)

  Indexes {
    sale_code [unique, name: "uk_sale_code"]
  }
}

Table "accounts" {
  "account_id" NUMBER(10)
  "account_number" VARCHAR2(20)
  "balance" NUMBER(12,2)

  Indexes {
    account_number [unique, name: "uk_account_number"]
  }
}
