CREATE TYPE "orders_status" AS ENUM (
  'created',
  'running',
  'done',
  'failure'
);

CREATE TYPE "product status" AS ENUM (
  'Out of Stock',
  'In Stock'
);

CREATE TABLE "orders" (
  "id" SERIAL PRIMARY KEY,
  "user_id" int UNIQUE NOT NULL,
  "status" orders_status,
  "created_at" varchar
);

CREATE TABLE "order_items" (
  "order_id" int,
  "product_id" int,
  "quantity" int DEFAULT 1
);

CREATE TABLE "products" (
  "id" int,
  "name" varchar,
  "merchant_id" int NOT NULL,
  "price" int,
  "status" "product status",
  "created_at" datetime DEFAULT (now()),
  PRIMARY KEY ("id", "name")
);

CREATE TABLE "users" (
  "id" int PRIMARY KEY,
  "full_name" varchar,
  "email" varchar UNIQUE,
  "gender" varchar,
  "date_of_birth" varchar,
  "created_at" varchar,
  "country_code" int
);

CREATE TABLE "merchants" (
  "id" int PRIMARY KEY,
  "merchant_name" varchar,
  "country_code" int,
  "created_at" varchar,
  "admin_id" int
);

CREATE TABLE "countries" (
  "code" int PRIMARY KEY,
  "name" varchar,
  "continent_name" varchar
);

ALTER TABLE "order_items" ADD FOREIGN KEY ("order_id") REFERENCES "orders" ("id");

ALTER TABLE "order_items" ADD FOREIGN KEY ("product_id") REFERENCES "products" ("id");

ALTER TABLE "users" ADD FOREIGN KEY ("country_code") REFERENCES "countries" ("code");

ALTER TABLE "merchants" ADD FOREIGN KEY ("country_code") REFERENCES "countries" ("code");

ALTER TABLE "products" ADD FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id");

ALTER TABLE "merchants" ADD FOREIGN KEY ("admin_id") REFERENCES "users" ("id");

CREATE INDEX "product_status" ON "products" ("merchant_id", "status");

CREATE UNIQUE INDEX ON "products" USING HASH ("id");
