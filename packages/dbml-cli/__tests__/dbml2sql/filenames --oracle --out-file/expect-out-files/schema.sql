CREATE TABLE "category" (
  "id" int PRIMARY KEY,
  "name" nvarchar2(255),
  "last_update" timestamp
);

CREATE TABLE "film_category" (
  "id" int PRIMARY KEY,
  "category_id" int,
  "last_update" timestamp
);

CREATE TABLE "language" (
  "id" int PRIMARY KEY,
  "name" nvarchar2(255),
  "last_update" timestamp
);

CREATE TABLE "film_text" (
  "id" int PRIMARY KEY,
  "film_id" int,
  "title" nvarchar2(255),
  "description" nclob
);

CREATE TABLE "actor" (
  "id" int PRIMARY KEY,
  "first_name" nvarchar2(255),
  "last_name" nvarchar2(255),
  "last_update" timestamp
);

CREATE TABLE "film" (
  "id" int PRIMARY KEY,
  "title" nvarchar2(255),
  "description" nclob,
  "releaase_year" int,
  "language_id" int,
  "original_language_id" int,
  "rental_duration" int,
  "rental_rate" float,
  "length" int,
  "replacement_cost" float,
  "rating" nvarchar2(255),
  "special_feature" nvarchar2(255),
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

ALTER TABLE "film_category" ADD FOREIGN KEY ("category_id") REFERENCES "category" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "film_text" ADD FOREIGN KEY ("film_id") REFERENCES "film" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "film" ADD FOREIGN KEY ("language_id") REFERENCES "language" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "film" ADD FOREIGN KEY ("original_language_id") REFERENCES "language" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "film_actor" ADD FOREIGN KEY ("film_id") REFERENCES "film" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "film_actor" ADD FOREIGN KEY ("actor_id") REFERENCES "actor" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inventory" ADD FOREIGN KEY ("film_id") REFERENCES "film" ("id") DEFERRABLE INITIALLY IMMEDIATE;
