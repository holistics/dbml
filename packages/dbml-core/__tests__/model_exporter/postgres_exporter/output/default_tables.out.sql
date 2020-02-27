CREATE TABLE "products" (
  "id" int PRIMARY KEY DEFAULT 123,
  "name" varchar DEFAULT 'Tea',
  "merchant_id" int NOT NULL,
  "price" float DEFAULT 123.12,
  "status" varchar DEFAULT NULL,
  "created_at" varchar DEFAULT (now()),
  "stock" boolean DEFAULT true,
  "expiration" date DEFAULT (current_date + interval 1 year)
);
