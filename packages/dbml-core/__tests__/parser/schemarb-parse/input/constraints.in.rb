# Test 1: Table-level CHECK constraints inside create_table (Rails 6.1+)
create_table "products" do |t|
  t.integer "id"
  t.decimal "price"
  t.integer "quantity"
  t.decimal "discount"
  t.check_constraint "price > 0", name: "price_positive"
  t.check_constraint "quantity >= 0"
end

# Test 2: Table with multiple named and unnamed CHECK constraints
create_table "employees" do |t|
  t.integer "emp_id"
  t.integer "age"
  t.decimal "salary"
  t.check_constraint "age >= 18 AND age <= 65", name: "chk_age"
  t.check_constraint "salary > 0", name: "chk_salary"
end

# Test 3: Table with complex CHECK constraint expressions
create_table "orders" do |t|
  t.integer "order_id"
  t.timestamp "order_date"
  t.timestamp "delivery_date"
  t.decimal "total"
  t.check_constraint "delivery_date > order_date"
  t.check_constraint "total >= 0"
end

# Test 4: Using add_check_constraint at top level (named)
create_table "shipments" do |t|
  t.integer "shipment_id"
  t.decimal "weight"
  t.decimal "cost"
end
add_check_constraint :shipments, "weight > 0", name: "chk_weight"
add_check_constraint :shipments, "cost >= 0", name: "chk_cost"

# Test 5: Using add_check_constraint without name
create_table "payments" do |t|
  t.integer "payment_id"
  t.decimal "amount"
end
add_check_constraint :payments, "amount > 0"

# Test 6: CHECK constraint with IN clause
create_table "users" do |t|
  t.integer "user_id"
  t.string "role"
  t.check_constraint "role NOT IN ('banned', 'deleted', 'suspended')"
end

# Test 7: CHECK constraint with multiple conditions
create_table "ranges" do |t|
  t.integer "range_id"
  t.integer "min_val"
  t.integer "max_val"
  t.check_constraint "(min_val >= 0) AND (max_val <= 100) AND (min_val < max_val)"
end

# Test 8: CHECK constraint with CASE expression
create_table "inventory" do |t|
  t.integer "item_id"
  t.integer "stock"
  t.string "status"
  t.check_constraint "CASE WHEN status = 'active' THEN stock WHEN status = 'discontinued' THEN 0 ELSE 1 END >= 0"
end

# Test 9: Mixed column-level and table-level constraints
create_table "accounts" do |t|
  t.integer "account_id"
  t.decimal "balance"
  t.decimal "overdraft_limit"
  t.check_constraint "balance + overdraft_limit >= 0", name: "chk_balance_overdraft"
end

# Test 10: Multiple CHECK constraints (mixed named and unnamed)
create_table "transactions" do |t|
  t.integer "txn_id"
  t.decimal "amount"
  t.decimal "fee"
  t.decimal "total"
  t.check_constraint "total = amount + fee"
  t.check_constraint "amount > 0 OR fee > 0"
end

# Test 11: CHECK constraint with string patterns
create_table "contacts" do |t|
  t.integer "contact_id"
  t.string "email"
  t.string "phone"
  t.check_constraint "email LIKE '%@%'"
end

# Test 12: Complex expressions with OR
create_table "settings" do |t|
  t.integer "setting_id"
  t.integer "value"
  t.check_constraint "value = 0 OR value = 1 OR value = -1"
end

# Test 13: add_check_constraint with string table name (double quotes)
create_table "pricing" do |t|
  t.integer "price_id"
  t.decimal "base_price"
  t.decimal "discount_pct"
  t.decimal "final_price"
end
add_check_constraint "pricing", "final_price = base_price * (1 - discount_pct / 100)"

# Test 14: Multiple add_check_constraint statements with different syntaxes
create_table "limits" do |t|
  t.integer "limit_id"
  t.integer "min_value"
  t.integer "max_value"
end
add_check_constraint :limits, "max_value > min_value"
add_check_constraint "limits", "min_value >= 0", name: "chk_min_positive"
