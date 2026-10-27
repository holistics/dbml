CREATE TABLE "orders" (
  "id" integer PRIMARY KEY,
  "customer_id" integer,
  "status" varchar,
  "created_at" timestamp
);

CREATE INDEX "orders_created" ON "orders" ("created_at" DESC);
CREATE INDEX "orders_customer_recent" ON "orders" ("customer_id", "created_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "orders_status_id" ON "orders" ("status" DESC, "id" ASC);
CREATE INDEX "orders_lower_status" ON "orders" (lower(status) DESC);
CREATE INDEX "orders_total" ON "orders" ((customer_id + id) DESC);
