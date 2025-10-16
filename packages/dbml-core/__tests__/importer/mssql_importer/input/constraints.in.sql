-- Comprehensive test for CHECK constraints in MSSQL
-- Tests various edge cases including brackets, quotes, complex expressions

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

-- Test 3: Constraints with bracket-quoted identifiers (MSSQL style)
CREATE TABLE [special_table] (
  [id] INT PRIMARY KEY,
  [price] DECIMAL CHECK ([price] > 0),
  [status] VARCHAR(20) CHECK ([status] IN ('active', 'inactive'))
);

-- Test 4: Constraints with complex expressions
CREATE TABLE [transactions] (
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
  phone VARCHAR(20) CHECK (phone LIKE '[0-9][0-9][0-9]-[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]')
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
      WHEN status = 'active' THEN stock
      WHEN status = 'discontinued' THEN 0
      ELSE 1
    END >= 0
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

-- Test 12: ALTER TABLE ADD CONSTRAINT (unnamed - MSSQL auto-generates name)
CREATE TABLE payments (
  payment_id INT PRIMARY KEY,
  amount DECIMAL(10,2)
);

ALTER TABLE payments ADD CHECK (amount > 0);

-- Test 13: Constraints with mathematical expressions
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
  CHECK (check_in >= GETDATE())
);

-- Test 16: Constraints with string functions
CREATE TABLE documents (
  doc_id INT PRIMARY KEY,
  title VARCHAR(200),
  content VARCHAR(MAX),
  CHECK (LEN(title) > 0),
  CHECK (LEN(content) >= 10)
);

-- Test 17: Multiple CHECK constraints with OR conditions
CREATE TABLE events (
  event_id INT PRIMARY KEY,
  status VARCHAR(20),
  cancelled BIT,
  CHECK (status = 'active' OR status = 'completed' OR cancelled = 1)
);

-- Test 18: Constraints with BETWEEN
CREATE TABLE grades (
  grade_id INT PRIMARY KEY,
  score INT,
  CHECK (score BETWEEN 0 AND 100)
);

-- Test 19: Named constraints with brackets in names
CREATE TABLE products_special (
  product_id INT PRIMARY KEY,
  code VARCHAR(50),
  CONSTRAINT [chk_code_format] CHECK (code LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9][0-9]')
);

-- Test 20: Constraint with bit column
CREATE TABLE features (
  feature_id INT PRIMARY KEY,
  is_enabled BIT,
  is_premium BIT,
  CHECK (is_enabled = 1 OR is_premium = 0)
);

-- Test 21: Constraints with ISNULL (MSSQL specific)
CREATE TABLE configs (
  config_id INT PRIMARY KEY,
  value1 INT,
  value2 INT,
  CHECK (ISNULL(value1, 0) + ISNULL(value2, 0) > 0)
);

-- Test 22: Multiple ALTER TABLE statements on same table
CREATE TABLE audit_log (
  log_id INT PRIMARY KEY,
  severity INT,
  message VARCHAR(MAX)
);

ALTER TABLE audit_log ADD CONSTRAINT chk_severity_range CHECK (severity BETWEEN 1 AND 5);
ALTER TABLE audit_log ADD CONSTRAINT chk_message_length CHECK (LEN(message) > 0);
ALTER TABLE audit_log ADD CHECK (severity > 0);

-- Test 23: Constraints with comparison operators
CREATE TABLE limits (
  limit_id INT PRIMARY KEY,
  min_value INT,
  max_value INT,
  CHECK (max_value > min_value),
  CHECK (min_value >= 0),
  CHECK (max_value <= 1000)
);

-- Test 24: Constraints with != and <> operators
CREATE TABLE statuses (
  status_id INT PRIMARY KEY,
  current_status VARCHAR(20),
  previous_status VARCHAR(20),
  CHECK (current_status != previous_status),
  CHECK (current_status <> '')
);

-- Test 25: Table with brackets in names and constraint expressions
CREATE TABLE [order_items] (
  [order_item_id] INT PRIMARY KEY,
  [order_id] INT,
  [quantity] INT,
  [unit_price] DECIMAL(10,2),
  CHECK ([quantity] > 0),
  CONSTRAINT [chk_price_positive] CHECK ([unit_price] > 0)
);

-- Test 26: Constraint with modulo operator
CREATE TABLE sequences (
  seq_id INT PRIMARY KEY,
  value INT,
  CHECK (value % 2 = 0)
);

-- Test 27: Constraint with ABS function
CREATE TABLE temperatures (
  temp_id INT PRIMARY KEY,
  celsius DECIMAL(5,2),
  CHECK (ABS(celsius) < 100)
);

-- Test 28: Constraint with CHARINDEX
CREATE TABLE emails (
  email_id INT PRIMARY KEY,
  email_address VARCHAR(100),
  CHECK (CHARINDEX('@', email_address) > 0)
);

-- Test 29: Constraint with UPPER/LOWER
CREATE TABLE codes (
  code_id INT PRIMARY KEY,
  code VARCHAR(50),
  CHECK (code = UPPER(code))
);

-- Test 30: Complex multi-column constraint
CREATE TABLE order_discounts (
  discount_id INT PRIMARY KEY,
  order_total DECIMAL(10,2),
  discount_pct DECIMAL(5,2),
  discount_amt DECIMAL(10,2),
  final_total DECIMAL(10,2),
  CONSTRAINT chk_discount_calculation CHECK (
    (discount_amt = order_total * discount_pct / 100) AND
    (final_total = order_total - discount_amt) AND
    (final_total >= 0)
  )
);
