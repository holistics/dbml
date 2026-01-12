Table "employees" {
  "emp_id" NUMBER(10)
  "emp_name" VARCHAR2(100)
  "salary" NUMBER(10,2)
  "commission_pct" NUMBER(3,2)
  "hire_date" DATE
  "email" VARCHAR2(100)
  "department_id" NUMBER(5)
  "status" VARCHAR2(20)
  "age" NUMBER(3)
  "performance_score" NUMBER(3,1)

  Checks {
    `salary > 0` [name: 'chk_salary_positive']
    `commission_pct BETWEEN 0 AND 1` [name: 'chk_commission_range']
    `status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED')` [name: 'chk_status_values']
    `email LIKE '%@%'` [name: 'chk_email_format']
    `age >= 18`
    `salary >= 0`
    `salary * 12 > 0` [name: 'chk_salary_calculation']
    `salary > 0 AND department_id IS NOT NULL` [name: 'chk_salary_dept_rules']
    `commission_pct > 0 OR salary > 50000` [name: 'chk_commission_or_salary']
    `email IS NOT NULL AND LENGTH(email) > 5` [name: 'chk_email_required']
    `CASE 
        WHEN status = 'ACTIVE' THEN salary > 0
        WHEN status = 'INACTIVE' THEN 1 = 1
        ELSE 1 = 1
    END = 1` [name: 'chk_salary_by_status']
    `LENGTH(TRIM(emp_name)) > 0` [name: 'chk_name_length']
    `hire_date <= SYSDATE` [name: 'chk_hire_date_valid']
    `(salary > 30000 AND age >= 21) OR 
    (salary <= 30000 AND age >= 18)` [name: 'chk_complex_conditions']
    `email = LOWER(email)` [name: 'chk_email_lowercase']
    `performance_score >= 0.0 AND performance_score <= 10.0` [name: 'chk_performance_range']
    `email LIKE '%@%.com' OR email LIKE '%@%.org'` [name: 'chk_email_domain']
    `status NOT IN ('PENDING', 'UNKNOWN')` [name: 'chk_status_not_invalid']
    `salary > 0 AND 
    salary < 1000000 AND
    age >= 18 AND 
    age <= 100 AND
    (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 1)) AND
    status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED')` [name: 'chk_comprehensive_validation']
    `age BETWEEN 18 AND 70` [name: 'chk_age_working']
    `department_id IS NOT NULL AND department_id > 0` [name: 'chk_dept_valid']
  }
}

Table "products" {
  "product_id" NUMBER(10)
  "product_name" VARCHAR2(200)
  "price" NUMBER(10,2)
  "discount_price" NUMBER(10,2)
  "stock_quantity" NUMBER(8)
  "category" VARCHAR2(50)
  "weight" NUMBER(8,2)

  Checks {
    `discount_price <= price` [name: 'chk_price_comparison']
    `stock_quantity >= 0`
    `category IS NOT NULL`
    `(price - discount_price) >= price * 0.05` [name: 'chk_price_margin']
    `weight > 0 AND weight < 10000` [name: 'chk_weight_reasonable']
    `NOT (price < 0)` [name: 'chk_price_not_negative']
    `UPPER(category) IN ('ELECTRONICS', 'CLOTHING', 'FOOD', 'BOOKS')` [name: 'chk_category_uppercase']
    `price * stock_quantity > 0 AND price / 100 < 100000` [name: 'chk_price_calculations']
    `(price - discount_price) * stock_quantity >= 0` [name: 'chk_discount_rules']
    `product_name IS NOT NULL`
    `LENGTH(product_name) <= 200` [name: 'chk_prod_name_length']
    `stock_quantity <= 1000000` [name: 'chk_stock_max']
  }
}
