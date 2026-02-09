Table "products" {
  "id" NUMBER [pk]
  "name" VARCHAR2(100) [not null]
  "category" VARCHAR2(50)
  "price" "NUMBER(10, 2)"
}

Table "suppliers" {
  "id" NUMBER [pk]
  "name" VARCHAR2(100) [not null]
  "country" VARCHAR2(50)
}

Records products(id, name, category, price) {
  1, 'Laptop', 'Electronics', 999.99
  2, 'Mouse', 'Electronics', 29.99
  3, 'Keyboard', 'Electronics', 79.99
  4, 'Monitor', 'Electronics', 299.99
  5, 'Desk', null, null
  6, 'Chair', null, 149.99
  7, `UPPER('tablet')`, null, `100 * 5`
  8, 'Headphones', null, `50.00 + 49.99`
}

Records suppliers(id, name, country) {
  1, 'TechCorp', 'USA'
  2, 'GlobalTech', 'Germany'
  3, 'AsiaSupply', 'China'
}
