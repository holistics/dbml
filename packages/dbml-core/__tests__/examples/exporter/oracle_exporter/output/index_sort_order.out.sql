CREATE TABLE "orders" (
  "id" integer PRIMARY KEY,
  "customer_id" integer,
  "status" varchar,
  "created_at" timestamp
);

CREATE INDEX ON "orders" ("created_at" DESC);

CREATE INDEX "orders_customer_recent" ON "orders" ("customer_id", "created_at" DESC);

CREATE UNIQUE INDEX ON "orders" ("status" DESC, "id");

CREATE INDEX ON "orders" (lower(status) DESC);
