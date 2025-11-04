Table "customers" {
  "cust_id" NUMBER(10)
  "cust_name" VARCHAR2(100)
  "email" VARCHAR2(100)
  "phone" VARCHAR2(20)

  Checks {
    `cust_id > 0`
  }
}

Table "inventory" {
  "item_id" NUMBER(10)
  "item_name" VARCHAR2(200)
  "price" NUMBER(10,2)
  "category" VARCHAR2(50)

  Checks {
    `price >= 0` [name: 'chk_price_pos']
  }
}

Table "shipments" {
  "ship_id" NUMBER(10)
  "customer_id" NUMBER(10)
  "ship_date" DATE
  "total_amount" NUMBER(12,2)

  Checks {
    `total_amount >= 0 AND ship_date IS NOT NULL` [name: 'chk_amount_date']
  }
}

Table "departments" {
  "dept_id" NUMBER(10)
  "dept_name" VARCHAR2(100)
  "manager_id" NUMBER(10)
  "budget" NUMBER(12,2)

  Checks {
    `budget >= 0`
  }
}

Table "suppliers" {
  "supp_id" NUMBER(10)
  "supp_name" VARCHAR2(100)
  "contact" VARCHAR2(100)
  "credit_limit" NUMBER(10,2)

  Checks {
    `credit_limit >= 0` [name: 'chk_credit_limit']
  }
}

Table "employees" {
  "emp_id" NUMBER(10)
  "emp_name" VARCHAR2(100)
  "email" VARCHAR2(100)
  "status" VARCHAR2(20)

  Checks {
    `status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')` [name: 'chk_status_values']
  }
}

Table "orders" {
  "order_id" NUMBER(10)
  "customer_id" NUMBER(10)
  "order_date" DATE
  "total_amount" NUMBER(12,2)
  "tax_amount" NUMBER(10,2)

  Checks {
    `total_amount >= tax_amount AND tax_amount >= 0` [name: 'chk_order_amounts']
  }
}

Table "contracts" {
  "contract_id" NUMBER(10)
  "start_date" DATE
  "end_date" DATE
  "amount" NUMBER(12,2)

  Checks {
    `end_date > start_date AND start_date >= SYSDATE` [name: 'chk_date_range']
  }
}

Table "users" {
  "user_id" NUMBER(10)
  "username" VARCHAR2(50)
  "email" VARCHAR2(100)
  "ssn" VARCHAR2(11)

  Checks {
    `ssn LIKE '[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'` [name: 'chk_ssn_format']
  }
}

Table "sales" {
  "sale_id" NUMBER(10)
  "sale_date" DATE
  "amount" NUMBER(12,2)
  "discount" NUMBER(10,2)

  Checks {
    `amount >= discount AND discount >= 0 AND sale_date >= SYSDATE` [name: 'chk_sale_complex']
  }
}

Table "accounts" {
  "account_id" NUMBER(10)
  "account_number" VARCHAR2(20)
  "balance" NUMBER(12,2)
  "account_type" VARCHAR2(20)

  Checks {
    `REGEXP_LIKE(account_number, '^[0-9]{10}$')` [name: 'chk_acc_number']
  }
}

Table "reports" {
  "report_id" NUMBER(10)
  "report_name" VARCHAR2(100)
  "report_date" DATE
  "status" VARCHAR2(20)

  Checks {
    `status IN ('DRAFT', 'FINAL', 'ARCHIVED')` [name: 'chk_very_long_constraint_name_for_testing_parser_limits']
  }
}

Table "employees_sub" {
  "emp_id" NUMBER(10)
  "dept_id" NUMBER(10)
  "emp_name" VARCHAR2(100)
  "salary" NUMBER(10,2)

  Checks {
    `dept_id IN (SELECT dept_id FROM departments)` [name: 'chk_dept_exists']
  }
}
