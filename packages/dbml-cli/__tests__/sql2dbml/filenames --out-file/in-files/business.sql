-- SQL dump generated using DBML (dbml-lang.org)
-- Database: PostgreSQL
-- Generated at: 2019-08-27T02:22:21.036Z

CREATE TABLE "staff" (
  "id" int PRIMARY KEY,
  "first_name" varchar,
  "last_name" varchar,
  "address_id" int,
  "picture" blob,
  "email" varchar,
  "store_id" int,
  "active" boolean,
  "user_name" varchar,
  "password" varchar,
  "last_update" timestamp
);

CREATE TABLE "store" (
  "id" int PRIMARY KEY,
  "manager_staff_id" int,
  "address_id" int,
  "last_update" timestamp
);

CREATE TABLE "payment" (
  "id" int PRIMARY KEY,
  "customer_id" int,
  "staff_id" int,
  "rental_id" int,
  "amount" decimal,
  "payment_date" datetime,
  "last_update" timestamp
);

CREATE TABLE "rental" (
  "id" int PRIMARY KEY,
  "rental_date" datetime,
  "inventory_id" int,
  "customer_id" int,
  "return_date" ddatetime,
  "staff_id" int,
  "last_update" timestamp
);

ALTER TABLE "staff" ADD FOREIGN KEY ("store_id") REFERENCES "store" ("id");

ALTER TABLE "store" ADD FOREIGN KEY ("manager_staff_id") REFERENCES "staff" ("id");

ALTER TABLE "payment" ADD FOREIGN KEY ("staff_id") REFERENCES "staff" ("id");

ALTER TABLE "payment" ADD FOREIGN KEY ("rental_id") REFERENCES "rental" ("id");

ALTER TABLE "rental" ADD FOREIGN KEY ("staff_id") REFERENCES "staff" ("id");
