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
  "created_at" varchar,
  "modified_at" timestamp(2)
);

CREATE TABLE "order_items" (
  "order_id" int,
  "product_id" int,
  "quantity" int DEFAULT 1,
  "created_at" timestamp with time zone,
  "modified_at" time with time zone
);

CREATE TABLE "products" (
  "id" int,
  "name" varchar,
  "merchant_id" int NOT NULL,
  "price" int,
  "status" "product status",
  "created_at" datetime DEFAULT (now()),
  "modified_at" timestamp without time zone,
  PRIMARY KEY ("id", "name")
);

CREATE TABLE "users" (
  "id" int PRIMARY KEY,
  "full_name" varchar,
  "email" varchar UNIQUE,
  "gender" varchar,
  "date_of_birth" varchar,
  "created_at" varchar,
  "modified_at" time(2),
  "country_code" int
);

CREATE TABLE "merchants" (
  "id" int PRIMARY KEY,
  "merchant_name" varchar,
  "country_code" int,
  "created_at" varchar,
  "modified_at" time without time zone,
  "admin_id" int
);

CREATE TABLE "countries" (
  "code" int PRIMARY KEY,
  "name" varchar,
  "continent_name" varchar
);

CREATE TABLE "foo" (
  "bar" text[],
  "bar2" int [ 1 ],
  "bar3" int[2][3 ],
  "bar4" int array,
  "bar5" int ARRAY [2],
  "bar6" text ARRAY[8],
  "bar7" text ARRAY[ 100 ],
  "bar8" time(2) with time zone [],
  "bar9" time(1) [1],
  "bar10" time(1) aRRay,
  "bar11" time aRray [5],
  "bar12" timestamp(2) without time zone[10][2][5],
  "bar13" character varying[],
  "bar14" character varying(25) [][2][],
  "bar15" character varying array [76]
);

ALTER TABLE "order_items" ADD FOREIGN KEY ("order_id") REFERENCES "orders" ("id");

ALTER TABLE "order_items" ADD FOREIGN KEY ("product_id") REFERENCES "products" ("id");

ALTER TABLE "users" ADD FOREIGN KEY ("country_code") REFERENCES "countries" ("code");

ALTER TABLE "merchants" ADD FOREIGN KEY ("country_code") REFERENCES "countries" ("code");

ALTER TABLE "products" ADD FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id");

ALTER TABLE "merchants" ADD FOREIGN KEY ("admin_id") REFERENCES "users" ("id");

CREATE INDEX "product_status" ON "products" ("merchant_id", "status");

CREATE UNIQUE INDEX ON "products" USING HASH ("id");

COMMENT ON TABLE "users" IS 'User data';

COMMENT ON TABLE "users" IS 'Store user data';

COMMENT ON TABLE "products" IS 'Products table comment';
