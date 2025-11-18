-- Oracle SQL ALTER TABLE ADD CHECK Constraint Test Cases
-- Test setup: Create base tables
CREATE TABLE employees (
    emp_id NUMBER(10),
    emp_name VARCHAR2(100),
    salary NUMBER(10,2),
    commission_pct NUMBER(3,2),
    hire_date DATE,
    email VARCHAR2(100),
    department_id NUMBER(5),
    status VARCHAR2(20),
    age NUMBER(3),
    performance_score NUMBER(3,1)
);

CREATE TABLE products (
    product_id NUMBER(10),
    product_name VARCHAR2(200),
    price NUMBER(10,2),
    discount_price NUMBER(10,2),
    stock_quantity NUMBER(8),
    category VARCHAR2(50),
    weight NUMBER(8,2)
);

-- ============================================
-- NAMED CHECK CONSTRAINTS
-- ============================================

-- Simple column value check with named constraint
ALTER TABLE employees 
ADD CONSTRAINT chk_salary_positive 
CHECK (salary > 0);

-- Range check with named constraint
ALTER TABLE employees 
ADD CONSTRAINT chk_commission_range 
CHECK (commission_pct BETWEEN 0 AND 1);

-- String pattern check with named constraint
ALTER TABLE employees 
ADD CONSTRAINT chk_status_values 
CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'));

-- Email format check with named constraint
ALTER TABLE employees 
ADD CONSTRAINT chk_email_format 
CHECK (email LIKE '%@%');

-- Multiple column comparison with named constraint
ALTER TABLE products 
ADD CONSTRAINT chk_price_comparison 
CHECK (discount_price <= price);

-- ============================================
-- UNNAMED CHECK CONSTRAINTS
-- ============================================

-- Simple check without constraint name
ALTER TABLE employees 
ADD CHECK (age >= 18);

-- Range check without name
ALTER TABLE products 
ADD CHECK (stock_quantity >= 0);

-- String value check without name
ALTER TABLE products 
ADD CHECK (category IS NOT NULL);

-- Comparison check without name
ALTER TABLE employees 
ADD CHECK (salary >= 0);

-- ============================================
-- COMPLEX EXPRESSION CHECKS
-- ============================================

-- Arithmetic expression
ALTER TABLE employees 
ADD CONSTRAINT chk_salary_calculation 
CHECK (salary * 12 > 0);

-- Multiple conditions with AND
ALTER TABLE employees 
ADD CONSTRAINT chk_salary_dept_rules 
CHECK (salary > 0 AND department_id IS NOT NULL);

-- Multiple conditions with OR
ALTER TABLE employees 
ADD CONSTRAINT chk_commission_or_salary 
CHECK (commission_pct > 0 OR salary > 50000);

-- Complex arithmetic with multiple columns
ALTER TABLE products 
ADD CONSTRAINT chk_price_margin 
CHECK ((price - discount_price) >= price * 0.05);

-- NULL handling
ALTER TABLE employees 
ADD CONSTRAINT chk_email_required 
CHECK (email IS NOT NULL AND LENGTH(email) > 5);

-- CASE expression in check
ALTER TABLE employees 
ADD CONSTRAINT chk_salary_by_status 
CHECK (
    CASE 
        WHEN status = 'ACTIVE' THEN salary > 0
        WHEN status = 'INACTIVE' THEN 1 = 1
        ELSE 1 = 1
    END = 1
);

-- Function calls in check
ALTER TABLE employees 
ADD CONSTRAINT chk_name_length 
CHECK (LENGTH(TRIM(emp_name)) > 0);

-- Mathematical functions
ALTER TABLE products 
ADD CONSTRAINT chk_weight_reasonable 
CHECK (weight > 0 AND weight < 10000);

-- Date comparison
ALTER TABLE employees 
ADD CONSTRAINT chk_hire_date_valid 
CHECK (hire_date <= SYSDATE);

-- NOT condition
ALTER TABLE products 
ADD CONSTRAINT chk_price_not_negative 
CHECK (NOT (price < 0));

-- Nested conditions
ALTER TABLE employees 
ADD CONSTRAINT chk_complex_conditions 
CHECK (
    (salary > 30000 AND age >= 21) OR 
    (salary <= 30000 AND age >= 18)
);

-- String functions
ALTER TABLE employees 
ADD CONSTRAINT chk_email_lowercase 
CHECK (email = LOWER(email));

-- UPPER/LOWER with IN clause
ALTER TABLE products 
ADD CONSTRAINT chk_category_uppercase 
CHECK (UPPER(category) IN ('ELECTRONICS', 'CLOTHING', 'FOOD', 'BOOKS'));

-- Multiple arithmetic operations
ALTER TABLE products 
ADD CONSTRAINT chk_price_calculations 
CHECK (price * stock_quantity > 0 AND price / 100 < 100000);

-- Combining comparison operators
ALTER TABLE employees 
ADD CONSTRAINT chk_performance_range 
CHECK (performance_score >= 0.0 AND performance_score <= 10.0);

-- Expression with parentheses
ALTER TABLE products 
ADD CONSTRAINT chk_discount_rules 
CHECK ((price - discount_price) * stock_quantity >= 0);

-- LIKE with wildcards
ALTER TABLE employees 
ADD CONSTRAINT chk_email_domain 
CHECK (email LIKE '%@%.com' OR email LIKE '%@%.org');

-- NOT IN clause
ALTER TABLE employees 
ADD CONSTRAINT chk_status_not_invalid 
CHECK (status NOT IN ('PENDING', 'UNKNOWN'));

-- ============================================
-- EDGE CASES AND SPECIAL SCENARIOS
-- ============================================

-- Very long expression
ALTER TABLE employees 
ADD CONSTRAINT chk_comprehensive_validation 
CHECK (
    salary > 0 AND 
    salary < 1000000 AND
    age >= 18 AND 
    age <= 100 AND
    (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 1)) AND
    status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED')
);

-- Multiple checks added in sequence for same table
ALTER TABLE products ADD CHECK (product_name IS NOT NULL);
ALTER TABLE products ADD CONSTRAINT chk_prod_name_length CHECK (LENGTH(product_name) <= 200);
ALTER TABLE products ADD CONSTRAINT chk_stock_max CHECK (stock_quantity <= 1000000);

-- Check with BETWEEN and NOT
ALTER TABLE employees 
ADD CONSTRAINT chk_age_working 
CHECK (age BETWEEN 18 AND 70);

-- Check constraint with IS NOT NULL combined with value check
ALTER TABLE employees 
ADD CONSTRAINT chk_dept_valid 
CHECK (department_id IS NOT NULL AND department_id > 0);
