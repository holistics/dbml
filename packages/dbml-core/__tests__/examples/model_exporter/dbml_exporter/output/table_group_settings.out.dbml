Enum "ecommerce"."products_status" {
  "out_of_stock"
  "in_stock"
  "running_low" [note: 'less than 20']
}

Table "ecommerce"."merchants" {
  "id" int
  "country_code" int
  "merchant_name" varchar
  "created at" varchar
  "admin_id" int

  Indexes {
    (id, country_code) [pk]
  }
}

Table "ecommerce"."order_items" [headerColor: #EB801B] {
  "order_id" int
  "product_id" int
  "quantity" int [default: 1]
}

Table "ecommerce"."orders" {
  "id" int [pk]
  "user_id" int [unique, not null]
  "status" varchar
  "created_at" varchar [note: 'When order created']
}

Table "ecommerce"."products" {
  "id" int [pk]
  "name" varchar
  "merchant_id" int [not null]
  "price" int
  "status" ecommerce.products_status
  "created_at" datetime [default: `now()`]

  Indexes {
    (merchant_id, status) [name: "product_status"]
    id [unique]
  }
}

Table "ecommerce"."product_tags" [headerColor: #011B4E] {
  "id" int [pk]
  "name" varchar
}

Table "ecommerce"."merchant_periods" [headerColor: #990D0D] {
  "id" int [pk]
  "merchant_id" int
  "country_code" int
  "start_date" datetime
  "end_date" datetime
}

Table "users" [headerColor: #6724BB] {
  "id" int [pk, increment]
  "full_name" varchar
  "created_at" timestamp
  "country_code" int
}

Table "countries" {
  "code" int [pk]
  "name" varchar
  "continent_name" varchar
}

TableGroup "e_commerce_merchants" [color: #111CCE] {
  "ecommerce"."merchant_periods"
  "ecommerce"."merchants"
  Note: '''This table group groups the \'merchant_periods\' and the \'merchants\' tables.
They are about people who buy and sell products in large amounts.
'''
}

TableGroup "e_commerce_products" [color: #DE65C3] {
  "ecommerce"."product_tags"
  "ecommerce"."products"
  Note: '''This table group groups the \'product_tags\' and the \'products\' tables.
They are about the products.
'''
}

TableGroup "e_commerce_orders" [color: #24BAB1] {
  "ecommerce"."orders"
  "ecommerce"."order_items"
}

Ref:"users"."id" < "ecommerce"."merchants"."admin_id"

Ref:"countries"."code" < "users"."country_code"

Ref:"countries"."code" < "ecommerce"."merchants"."country_code"

Ref:"ecommerce"."orders"."id" < "ecommerce"."order_items"."order_id"

Ref:"ecommerce"."products"."id" < "ecommerce"."order_items"."product_id"

Ref:"ecommerce"."merchants"."id" < "ecommerce"."products"."merchant_id"

Ref:"ecommerce"."product_tags"."id" <> "ecommerce"."products"."id"

Ref:"ecommerce"."merchants".("id", "country_code") < "ecommerce"."merchant_periods".("merchant_id", "country_code")
