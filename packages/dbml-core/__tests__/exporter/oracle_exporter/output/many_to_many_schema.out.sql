CREATE USER "C##test"
NO AUTHENTICATION
DEFAULT TABLESPACE system
TEMPORARY TABLESPACE temp
QUOTA UNLIMITED ON system;

CREATE TABLE "users" (
  "id" int PRIMARY KEY,
  "name" nvarchar2(255) NOT NULL
);

CREATE TABLE "products" (
  "id" int PRIMARY KEY,
  "user_id" int NOT NULL
);

CREATE TABLE "C##test"."users" (
  "id" int PRIMARY KEY,
  "name" nvarchar2(255) NOT NULL
);

CREATE TABLE "C##test"."products" (
  "id" int PRIMARY KEY,
  "user_id" int NOT NULL
);

CREATE TABLE "users_products" (
  "users_id" int,
  "products_user_id" int,
  PRIMARY KEY ("users_id", "products_user_id")
);

ALTER TABLE "users_products" ADD FOREIGN KEY ("users_id") REFERENCES "users" ("id");

ALTER TABLE "users_products" ADD FOREIGN KEY ("products_user_id") REFERENCES "products" ("user_id");

CREATE TABLE "C##test"."users_products(1)" (
  "users_id" int,
  "products_user_id" int,
  PRIMARY KEY ("users_id", "products_user_id")
);

ALTER TABLE "C##test"."users_products(1)" ADD FOREIGN KEY ("users_id") REFERENCES "C##test"."users" ("id");

ALTER TABLE "C##test"."users_products(1)" ADD FOREIGN KEY ("products_user_id") REFERENCES "C##test"."products" ("user_id");
