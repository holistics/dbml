Table "products" {
  "id" INT [pk]
  "price" DECIMAL(10,2) [check: `price > 0`]
  "quantity" INT [check: `quantity >= 0`]
  "discount" DECIMAL(5,2) [check: `discount >= 0 AND discount <= 100`]
}

Table "employees" {
  "emp_id" INT [pk]
  "age" INT
  "salary" DECIMAL(10,2)

  Checks {
    `age >= 18 AND age <= 65` [name: 'chk_age']
    `salary > 0` [name: 'chk_salary']
  }
}

Table "special_table" {
  "id" INT [pk]
  "price" DECIMAL [check: `[price] > 0`]
  "status" VARCHAR(20) [check: `[status] IN ('active', 'inactive')`]
}

Table "transactions" {
  "txn_id" INT [pk]
  "amount" DECIMAL(10,2)
  "fee" DECIMAL(10,2)
  "total" DECIMAL(10,2)

  Checks {
    `total = amount + fee`
    `amount > 0 OR fee > 0`
  }
}

Table "contacts" {
  "contact_id" INT [pk]
  "email" VARCHAR(100) [check: `email LIKE '%@%'`]
  "phone" VARCHAR(20) [check: `phone LIKE '[0-9][0-9][0-9]-[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]'`]
}

Table "orders" {
  "order_id" INT [pk]
  "status" VARCHAR(20) [check: `status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')`]
  "priority" INT [check: `priority IN (1, 2, 3, 4, 5)`]
}

Table "users" {
  "user_id" INT [pk]
  "role" VARCHAR(20) [check: `role NOT IN ('banned', 'deleted', 'suspended')`]
}

Table "ranges" {
  "range_id" INT [pk]
  "min_val" INT
  "max_val" INT

  Checks {
    `(min_val >= 0) AND (max_val <= 100) AND (min_val < max_val)`
  }
}

Table "inventory" {
  "item_id" INT [pk]
  "stock" INT
  "status" VARCHAR(20)

  Checks {
    `CASE
      WHEN status = 'active' THEN stock
      WHEN status = 'discontinued' THEN 0
      ELSE 1
    END >= 0`
  }
}

Table "accounts" {
  "account_id" INT [pk]
  "balance" DECIMAL(15,2) [check: `balance >= 0`]
  "overdraft_limit" DECIMAL(15,2) [check: `overdraft_limit >= 0`]

  Checks {
    `balance + overdraft_limit >= 0` [name: 'chk_balance_overdraft']
  }
}

Table "shipments" {
  "shipment_id" INT [pk]
  "weight" DECIMAL(10,2)
  "cost" DECIMAL(10,2)

  Checks {
    `weight > 0` [name: 'chk_weight']
    `cost >= 0` [name: 'chk_cost']
  }
}

Table "payments" {
  "payment_id" INT [pk]
  "amount" DECIMAL(10,2)

  Checks {
    `amount > 0`
  }
}

Table "pricing" {
  "price_id" INT [pk]
  "base_price" DECIMAL(10,2)
  "discount_pct" DECIMAL(5,2)
  "final_price" DECIMAL(10,2)

  Checks {
    `final_price = base_price * (1 - discount_pct / 100)`
  }
}

Table "settings" {
  "setting_id" INT [pk]
  "value" VARCHAR(100)
  "default_value" VARCHAR(100)

  Checks {
    `COALESCE(value, default_value) IS NOT NULL`
  }
}

Table "bookings" {
  "booking_id" INT [pk]
  "check_in" DATE
  "check_out" DATE

  Checks {
    `check_out > check_in`
    `check_in >= GETDATE()`
  }
}

Table "documents" {
  "doc_id" INT [pk]
  "title" VARCHAR(200)
  "content" VARCHAR(MAX)

  Checks {
    `LEN(title) > 0`
    `LEN(content) >= 10`
  }
}

Table "events" {
  "event_id" INT [pk]
  "status" VARCHAR(20)
  "cancelled" BIT

  Checks {
    `status = 'active' OR status = 'completed' OR cancelled = 1`
  }
}

Table "grades" {
  "grade_id" INT [pk]
  "score" INT

  Checks {
    `score BETWEEN 0 AND 100`
  }
}

Table "products_special" {
  "product_id" INT [pk]
  "code" VARCHAR(50)

  Checks {
    `code LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9][0-9]'` [name: 'chk_code_format']
  }
}

Table "features" {
  "feature_id" INT [pk]
  "is_enabled" BIT
  "is_premium" BIT

  Checks {
    `is_enabled = 1 OR is_premium = 0`
  }
}

Table "configs" {
  "config_id" INT [pk]
  "value1" INT
  "value2" INT

  Checks {
    `ISNULL(value1, 0) + ISNULL(value2, 0) > 0`
  }
}

Table "audit_log" {
  "log_id" INT [pk]
  "severity" INT
  "message" VARCHAR(MAX)

  Checks {
    `severity BETWEEN 1 AND 5` [name: 'chk_severity_range']
    `LEN(message) > 0` [name: 'chk_message_length']
    `severity > 0`
  }
}

Table "limits" {
  "limit_id" INT [pk]
  "min_value" INT
  "max_value" INT

  Checks {
    `max_value > min_value`
    `min_value >= 0`
    `max_value <= 1000`
  }
}

Table "statuses" {
  "status_id" INT [pk]
  "current_status" VARCHAR(20)
  "previous_status" VARCHAR(20)

  Checks {
    `current_status != previous_status`
    `current_status <> ''`
  }
}

Table "order_items" {
  "order_item_id" INT [pk]
  "order_id" INT
  "quantity" INT
  "unit_price" DECIMAL(10,2)

  Checks {
    `[quantity] > 0`
    `[unit_price] > 0` [name: 'chk_price_positive']
  }
}

Table "sequences" {
  "seq_id" INT [pk]
  "value" INT

  Checks {
    `value % 2 = 0`
  }
}

Table "temperatures" {
  "temp_id" INT [pk]
  "celsius" DECIMAL(5,2)

  Checks {
    `ABS(celsius) < 100`
  }
}

Table "emails" {
  "email_id" INT [pk]
  "email_address" VARCHAR(100)

  Checks {
    `CHARINDEX('@', email_address) > 0`
  }
}

Table "codes" {
  "code_id" INT [pk]
  "code" VARCHAR(50)

  Checks {
    `code = UPPER(code)`
  }
}

Table "order_discounts" {
  "discount_id" INT [pk]
  "order_total" DECIMAL(10,2)
  "discount_pct" DECIMAL(5,2)
  "discount_amt" DECIMAL(10,2)
  "final_total" DECIMAL(10,2)

  Checks {
    `(discount_amt = order_total * discount_pct / 100) AND
    (final_total = order_total - discount_amt) AND
    (final_total >= 0)` [name: 'chk_discount_calculation']
  }
}
