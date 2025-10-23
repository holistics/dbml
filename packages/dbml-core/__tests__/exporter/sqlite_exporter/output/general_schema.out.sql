PRAGMA foreign_keys = ON;

CREATE TABLE "orders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER UNIQUE NOT NULL,
  "status" TEXT CHECK ("status" IN ('created','running','done','failure')),
  "created_at" TEXT
);

CREATE TABLE "countries" (
  "code" INTEGER PRIMARY KEY,
  "name" TEXT,
  "continent_name" TEXT
);

CREATE TABLE "users" (
  "id" INTEGER PRIMARY KEY,
  "full_name" TEXT,
  "email" TEXT UNIQUE,
  "gender" TEXT,
  "date_of_birth" TEXT,
  "created_at" TEXT,
  "country_code" INTEGER,
  FOREIGN KEY ("country_code") REFERENCES "countries" ("code")
);

CREATE TABLE "merchants" (
  "id" INTEGER PRIMARY KEY,
  "merchant_name" TEXT,
  "country_code" INTEGER,
  "created_at" TEXT,
  "admin_id" INTEGER,
  FOREIGN KEY ("country_code") REFERENCES "countries" ("code"),
  FOREIGN KEY ("admin_id") REFERENCES "users" ("id")
);

CREATE TABLE "products" (
  "id" INTEGER,
  "name" TEXT,
  "merchant_id" INTEGER NOT NULL,
  "price" INTEGER,
  "status" TEXT CHECK ("status" IN ('Out of Stock','In Stock')),
  "created_at" TEXT DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY ("id","name"),
  FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id")
);

CREATE TABLE "order_items" (
  "order_id" INTEGER,
  "product_id" INTEGER,
  "quantity" INTEGER DEFAULT 1,
  FOREIGN KEY ("order_id") REFERENCES "orders" ("id"),
  FOREIGN KEY ("product_id") REFERENCES "products" ("id")
);

CREATE INDEX "product_status" ON "products" ("merchant_id","status");

CREATE UNIQUE INDEX "products_index_1" ON "products" ("id");
