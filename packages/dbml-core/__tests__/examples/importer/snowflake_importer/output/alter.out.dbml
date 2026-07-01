Table "customers" {
  "customer_id" INT
  "first_name" VARCHAR(50)
  "last_name" VARCHAR(50)
  "email" VARCHAR(100)
  "registration_date" DATE

  Indexes {
    email [unique]
  }
}

Table "orders" {
  "order_id" INT
  "customer_id" INT
  "order_date" DATE
  "total_amount" DECIMAL(10,2)
}

Table "employees" {
  "employee_id" INT
  "first_name" VARCHAR(50)
  "last_name" VARCHAR(50)
  "hire_date" DATE
  "department" VARCHAR(50)
}

Ref:"customers"."customer_id" < "orders"."customer_id"
