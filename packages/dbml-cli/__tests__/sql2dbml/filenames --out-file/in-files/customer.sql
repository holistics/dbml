-- SQL dump generated using DBML (dbml-lang.org)
-- Database: PostgreSQL
-- Generated at: 2019-08-27T02:21:56.043Z

CREATE TABLE "country" (
  "id" int PRIMARY KEY,
  "country" varchar,
  "last_update" timestamp
);

CREATE TABLE "city" (
  "id" int PRIMARY KEY,
  "city" varchar,
  "country_id" int,
  "last_update" timestamp
);

CREATE TABLE "address" (
  "id" int PRIMARY KEY,
  "address" varchar,
  "address2" varchar,
  "district" varchar,
  "city_id" int,
  "postal_code" varchar,
  "phone" varchar,
  "last_update" timestamp
);

CREATE TABLE "customer" (
  "id" int PRIMARY KEY,
  "store_id" int,
  "first_name" varchar,
  "last_name" varchar,
  "email" varchar,
  "address_id" int,
  "active" boolean,
  "create_Date" timestamp,
  "last_update" timestamp
);

ALTER TABLE "city" ADD FOREIGN KEY ("country_id") REFERENCES "country" ("id");

ALTER TABLE "address" ADD FOREIGN KEY ("city_id") REFERENCES "city" ("id");

ALTER TABLE "customer" ADD FOREIGN KEY ("address_id") REFERENCES "address" ("id");

CREATE INDEX ON "customer" USING BTREE ("id", "first_name");
