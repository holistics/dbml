-- SQL dump generated using DBML (dbml-lang.org)
-- Database: PostgreSQL
-- Generated at: 2019-08-27T02:22:09.733Z

CREATE TABLE "category" (
  "id" int PRIMARY KEY,
  "name" varchar,
  "last_update" timestamp
);

CREATE TABLE "film_category" (
  "id" int PRIMARY KEY,
  "category_id" int,
  "last_update" timestamp
);

CREATE TABLE "language" (
  "id" int PRIMARY KEY,
  "name" varchar,
  "last_update" timestamp
);

CREATE TABLE "film_text" (
  "id" int PRIMARY KEY,
  "film_id" int,
  "title" varchar,
  "description" text
);

CREATE TABLE "actor" (
  "id" int PRIMARY KEY,
  "first_name" varchar,
  "last_name" varchar,
  "last_update" timestamp
);

CREATE TABLE "film" (
  "id" int PRIMARY KEY,
  "title" varchar,
  "description" text,
  "releaase_year" int,
  "language_id" int,
  "original_language_id" int,
  "rental_duration" int,
  "rental_rate" decimal,
  "length" int,
  "replacement_cost" decimal,
  "rating" varchar,
  "special_feature" varchar,
  "last_update" timestamp
);

CREATE TABLE "film_actor" (
  "id" int PRIMARY KEY,
  "film_id" int,
  "actor_id" int,
  "last_update" timestamp
);

CREATE TABLE "inventory" (
  "id" int PRIMARY KEY,
  "film_id" int,
  "store_id" int,
  "last_update" timestamp
);

ALTER TABLE "film_category" ADD FOREIGN KEY ("category_id") REFERENCES "category" ("id");

ALTER TABLE "film_text" ADD FOREIGN KEY ("film_id") REFERENCES "inventory" ("film_id");

ALTER TABLE "film" ADD FOREIGN KEY ("language_id") REFERENCES "language" ("id");

ALTER TABLE "film" ADD FOREIGN KEY ("original_language_id") REFERENCES "language" ("id");

ALTER TABLE "film_actor" ADD FOREIGN KEY ("film_id") REFERENCES "film" ("id");

ALTER TABLE "film_actor" ADD FOREIGN KEY ("actor_id") REFERENCES "actor" ("id");

ALTER TABLE "inventory" ADD FOREIGN KEY ("film_id") REFERENCES "film" ("id");
