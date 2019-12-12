CREATE TABLE "orders" (
  "id" SERIAL PRIMARY KEY,
  "user_id" int NOT NULL,
  "created_at" datetime DEFAULT (now()),
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT
);

CREATE TABLE "order_items" (
  "id" SERIAL PRIMARY KEY,
  "order_id" int NOT NULL REFERENCES "orders" ("id") ON DELETE CASCADE,
  "product_id" int DEFAULT null,
  "quantity" int DEFAULT 1,
  FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL
);

CREATE TABLE "products" (
  "id" SERIAL PRIMARY KEY,
  "name" varchar,
  "price" decimal(10,4),
  "created_at" datetime DEFAULT (now())
);

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "name" varchar,
  "email" varchar UNIQUE,
  "date_of_birth" datetime,
  "created_at" datetime DEFAULT (now()),
  "country_code" int NOT NULL,
  FOREIGN KEY ("country_code") REFERENCES "countries" ("code") ON DELETE NO ACTION
);

CREATE TABLE "countries" (
  "code" int PRIMARY KEY,
  "name" varchar,
  "continent_name" varchar
);
