CREATE TABLE "users" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "username" nvarchar2(255) NOT NULL,
  "fullname" nvarchar2(255) NOT NULL
);

CREATE TABLE "orders" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "status" nvarchar2(255) NOT NULL CHECK ("status" IN ('created', 'pending', 'processing', 'waiting_for_payment', 'success', 'cancel')),
  "note" nclob DEFAULT '',
  "user_id" integer NOT NULL,
  "created_at" timestamp DEFAULT current_timestamp,
  "product_id" int,
  "supplier_id" int
);

CREATE TABLE "order_details" (
  "order_id" INT UNIQUE NOT NULL,
  "unit" nvarchar2(50) NOT NULL,
  "quantity" number NOT NULL,
  "price" float NOT NULL
);

CREATE TABLE "products" (
  "product_id" int,
  "supplier_id" int,
  PRIMARY KEY ("product_id", "supplier_id")
);

CREATE INDEX "IDX_USERS" ON "users" (LOWER("fullname"), "username");

CREATE UNIQUE INDEX "IDX_ORDER_USER" ON "orders" ("id", "user_id");

COMMENT ON TABLE "users" IS 'This table has a expression index';

COMMENT ON COLUMN "orders"."user_id" IS 'Store user uuid';

ALTER TABLE "orders" ADD FOREIGN KEY ("product_id", "supplier_id") REFERENCES "products" ("product_id", "supplier_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "orders" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "order_details" ADD FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
