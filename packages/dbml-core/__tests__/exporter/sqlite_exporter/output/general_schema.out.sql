CREATE TABLE "orders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER UNIQUE NOT NULL,
  "status" TEXT,
  "created_at" TEXT
);

CREATE TABLE "order_items" (
  "order_id" INTEGER,
  "product_id" INTEGER,
  "quantity" INTEGER DEFAULT 1
);

CREATE TABLE "products" (
  "id" INTEGER,
  "name" TEXT,
  "merchant_id" INTEGER NOT NULL,
  "price" INTEGER,
  "status" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "users" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "full_name" TEXT,
  "email" TEXT UNIQUE,
  "gender" TEXT,
  "date_of_birth" TEXT,
  "created_at" TEXT,
  "country_code" INTEGER
);

CREATE TABLE "merchants" (
  "id" INTEGER PRIMARY KEY,
  "merchant_name" TEXT,
  "country_code" INTEGER,
  "created_at" TEXT,
  "admin_id" INTEGER
);

CREATE TABLE "countries" (
  "code" INTEGER PRIMARY KEY,
  "name" TEXT,
  "continent_name" TEXT
);

