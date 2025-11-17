-- Comprehensive test for CHECK constraints in PostgreSQL
-- Tests various edge cases including backticks, quotes, complex expressions

-- Test 1: Column-level constraints with simple conditions
CREATE TABLE products (
  id INT PRIMARY KEY,
  price DECIMAL(10,2) CHECK (price > 0),
  quantity INT CHECK (quantity >= 0),
  discount DECIMAL(5,2) CHECK (discount >= 0 AND discount <= 100)
);

-- Test 2: Table-level named constraints
CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  age INT,
  salary DECIMAL(10,2),
  CONSTRAINT chk_age CHECK (age >= 18 AND age <= 65),
  CONSTRAINT chk_salary CHECK (salary > 0)
);

-- Test 3: Constraints with quoted identifiers (should be preserved)
CREATE TABLE "special_table" (
  "id" INT PRIMARY KEY,
  "price" DECIMAL CHECK ("price" > 0),
  "status" VARCHAR(20) CHECK ("status" IN ('active', 'inactive'))
);

-- Test 4: Constraints with complex expressions
CREATE TABLE transactions (
  txn_id INT PRIMARY KEY,
  amount DECIMAL(10,2),
  fee DECIMAL(10,2),
  total DECIMAL(10,2),
  CHECK (total = amount + fee),
  CHECK (amount > 0 OR fee > 0)
);

-- Test 5: Constraints with string comparisons and LIKE
CREATE TABLE contacts (
  contact_id INT PRIMARY KEY,
  email VARCHAR(100) CHECK (email LIKE '%@%'),
  phone VARCHAR(20) CHECK (phone ~ '^[0-9]{3}-[0-9]{3}-[0-9]{4}$')
);

-- Test 6: Constraints with IN operator and multiple values
CREATE TABLE orders (
  order_id INT PRIMARY KEY,
  status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  priority INT CHECK (priority IN (1, 2, 3, 4, 5))
);

-- Test 7: Constraints with NOT IN
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  role VARCHAR(20) CHECK (role NOT IN ('banned', 'deleted', 'suspended'))
);

-- Test 8: Constraints with nested parentheses
CREATE TABLE ranges (
  range_id INT PRIMARY KEY,
  min_val INT,
  max_val INT,
  CHECK ((min_val >= 0) AND (max_val <= 100) AND (min_val < max_val))
);

-- Test 9: Constraints with CASE expressions
CREATE TABLE inventory (
  item_id INT PRIMARY KEY,
  stock INT,
  status VARCHAR(20),
  CHECK (
    CASE
      WHEN status = 'active' THEN stock >= 0
      WHEN status = 'discontinued' THEN stock = 0
      ELSE TRUE
    END
  )
);

-- Test 10: Multiple constraints on same table (mixed column and table level)
CREATE TABLE accounts (
  account_id INT PRIMARY KEY,
  balance DECIMAL(15,2) CHECK (balance >= 0),
  overdraft_limit DECIMAL(15,2) CHECK (overdraft_limit >= 0),
  CONSTRAINT chk_balance_overdraft CHECK (balance + overdraft_limit >= 0)
);

-- Test 11: ALTER TABLE ADD CONSTRAINT (named)
CREATE TABLE shipments (
  shipment_id INT PRIMARY KEY,
  weight DECIMAL(10,2),
  cost DECIMAL(10,2)
);

ALTER TABLE shipments ADD CONSTRAINT chk_weight CHECK (weight > 0);
ALTER TABLE shipments ADD CONSTRAINT chk_cost CHECK (cost >= 0);

-- Test 12: ALTER TABLE ADD CONSTRAINT (unnamed)
CREATE TABLE payments (
  payment_id INT PRIMARY KEY,
  amount DECIMAL(10,2)
);

ALTER TABLE payments ADD CHECK (amount > 0);

-- Test 13: Constraints with subquery-like expressions (without actual subquery)
CREATE TABLE pricing (
  price_id INT PRIMARY KEY,
  base_price DECIMAL(10,2),
  discount_pct DECIMAL(5,2),
  final_price DECIMAL(10,2),
  CHECK (final_price = base_price * (1 - discount_pct / 100))
);

-- Test 14: Constraints with COALESCE and NULL handling
CREATE TABLE settings (
  setting_id INT PRIMARY KEY,
  value VARCHAR(100),
  default_value VARCHAR(100),
  CHECK (COALESCE(value, default_value) IS NOT NULL)
);

-- Test 15: Constraints with date/time operations
CREATE TABLE bookings (
  booking_id INT PRIMARY KEY,
  check_in DATE,
  check_out DATE,
  CHECK (check_out > check_in),
  CHECK (check_in >= CURRENT_DATE)
);

-- Test 16: Constraints with mathematical operations
CREATE TABLE circles (
  circle_id INT PRIMARY KEY,
  radius DECIMAL(10,2),
  area DECIMAL(15,2),
  CHECK (area > 0),
  CHECK (radius > 0)
);

-- Test 17: Constraints with string functions
CREATE TABLE documents (
  doc_id INT PRIMARY KEY,
  title VARCHAR(200),
  content TEXT,
  CHECK (LENGTH(title) > 0),
  CHECK (LENGTH(content) >= 10)
);

-- Test 18: Multiple CHECK constraints with OR conditions
CREATE TABLE events (
  event_id INT PRIMARY KEY,
  status VARCHAR(20),
  cancelled BOOLEAN,
  CHECK (status = 'active' OR status = 'completed' OR cancelled = TRUE)
);

-- Test 19: Constraints with type casts
CREATE TABLE measurements (
  measurement_id INT PRIMARY KEY,
  value VARCHAR(50),
  CHECK (value::NUMERIC > 0)
);

-- Test 20: Constraints with BETWEEN
CREATE TABLE grades (
  grade_id INT PRIMARY KEY,
  score INT,
  CHECK (score BETWEEN 0 AND 100)
);

-- Test 21: Named constraints with special characters in expression
CREATE TABLE products_special (
  product_id INT PRIMARY KEY,
  code VARCHAR(50),
  CONSTRAINT "chk_code_format" CHECK (code ~ '^[A-Z]{3}-[0-9]{4}$')
);

-- Test 22: Constraint with boolean column
CREATE TABLE features (
  feature_id INT PRIMARY KEY,
  is_enabled BOOLEAN,
  is_premium BOOLEAN,
  CHECK (is_enabled = TRUE OR is_premium = FALSE)
);

-- Test 23: Constraint with array operations (PostgreSQL specific)
CREATE TABLE tags_table (
  id INT PRIMARY KEY,
  tags TEXT[],
  CHECK (array_length(tags, 1) > 0)
);

-- Test 24: Constraint with JSON validation (PostgreSQL specific)
CREATE TABLE configs (
  config_id INT PRIMARY KEY,
  settings JSONB,
  CHECK (settings IS NOT NULL)
);

-- Test 25: Multiple ALTER TABLE statements on same table
CREATE TABLE audit_log (
  log_id INT PRIMARY KEY,
  severity INT,
  message TEXT
);

ALTER TABLE audit_log ADD CONSTRAINT chk_severity_range CHECK (severity BETWEEN 1 AND 5);
ALTER TABLE audit_log ADD CONSTRAINT chk_message_length CHECK (LENGTH(message) > 0);
ALTER TABLE audit_log ADD CHECK (severity > 0);
