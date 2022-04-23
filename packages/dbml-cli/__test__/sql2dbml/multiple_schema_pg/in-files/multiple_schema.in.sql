CREATE SCHEMA "schemaB";

CREATE SCHEMA "ecommerce";

CREATE SCHEMA "schemaA";

CREATE TYPE "job_status" AS ENUM (
  'created2',
  'running2',
  'done2',
  'failure2'
);

CREATE TYPE "gender" AS ENUM (
  'male2',
  'female2'
);

CREATE TYPE "schemaB"."gender" AS ENUM (
  'male',
  'female'
);

CREATE TABLE "users" (
  "id" int PRIMARY KEY,
  "name" varchar,
  "pjs" job_status,
  "pjs2" job_status,
  "pg" schemaB.gender,
  "pg2" gender
);

CREATE TABLE "products" (
  "id" int PRIMARY KEY,
  "name" varchar
);

CREATE TABLE "ecommerce"."users" (
  "id" int PRIMARY KEY,
  "name" varchar,
  "ejs" job_status,
  "ejs2" job_status,
  "eg" schemaB.gender,
  "eg2" gender
);

CREATE TABLE "schemaA"."products" (
  "id" int PRIMARY KEY,
  "name" varchar,
  "lid" int,
  CONSTRAINT fk_1 FOREIGN KEY(lid) REFERENCES "schemaA"."locations"(id)
);

CREATE TABLE "schemaA"."locations" (
  "id" int PRIMARY KEY,
  "name" varchar
);

CREATE INDEX "product_status" ON "schemaA"."products" ("id", "name");

CREATE UNIQUE INDEX ON "products" USING HASH ("id");

COMMENT ON TABLE "schemaA"."locations" IS 'This is a note in table "locations"';

COMMENT ON TABLE "users" IS 'Sample note on table users';

COMMENT ON COLUMN "schemaA"."products"."name" IS 'Product name of schemaA';

COMMENT ON COLUMN "products"."name" IS 'Product name of table products in public schema';

ALTER TABLE "ecommerce"."users" ADD FOREIGN KEY ("id") REFERENCES "users" ("id");

ALTER TABLE "ecommerce"."users" ADD CONSTRAINT "name_optional" FOREIGN KEY ("id") REFERENCES "users" ("name");

ALTER TABLE "schemaA"."products" ADD FOREIGN KEY ("name") REFERENCES "ecommerce"."users" ("id");

ALTER TABLE "schemaA"."locations" ADD FOREIGN KEY ("name") REFERENCES "users" ("id");
