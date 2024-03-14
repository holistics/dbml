CREATE USER "C##test"
NO AUTHENTICATION
DEFAULT TABLESPACE system
TEMPORARY TABLESPACE temp
QUOTA UNLIMITED ON system;

CREATE TABLE "users" (
  "id" int PRIMARY KEY
);

CREATE TABLE "products" (
  "id" int PRIMARY KEY
);

CREATE TABLE "users_products" (
  "users_id" int,
  "products_id" int,
  PRIMARY KEY ("users_id", "products_id")
);

CREATE TABLE "C##test"."users_products" (
  "users_id" int,
  "products_id" int,
  PRIMARY KEY ("users_id", "products_id")
);

CREATE TABLE "C##test"."users" (
  "id" int PRIMARY KEY
);

CREATE TABLE "C##test"."products" (
  "id" int PRIMARY KEY
);

ALTER TABLE "users_products" ADD FOREIGN KEY ("users_id") REFERENCES "users" ("id");

ALTER TABLE "users_products" ADD FOREIGN KEY ("products_id") REFERENCES "products" ("id");

ALTER TABLE "C##test"."users_products" ADD FOREIGN KEY ("users_id") REFERENCES "C##test"."users" ("id");

ALTER TABLE "C##test"."users_products" ADD FOREIGN KEY ("products_id") REFERENCES "C##test"."products" ("id");
