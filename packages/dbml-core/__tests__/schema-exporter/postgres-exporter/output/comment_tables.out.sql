CREATE TYPE "products_status" AS ENUM (
  'out_of_stock',
  'in_stock',
  'running_low'
);

CREATE TABLE "orders" (
  "id" int PRIMARY KEY,
  "user_id" int UNIQUE NOT NULL,
  "status" varchar,
  "created_at" varchar
);

COMMENT ON COLUMN "orders"."status" IS 'Status of an order';

COMMENT ON COLUMN "orders"."created_at" IS 'When order created';
