CREATE TABLE "users" (
  "id" int,
  "full_name" varchar,
  "email" varchar UNIQUE,
  "gender" varchar,
  "date_of_birth" varchar,
  "created_at" varchar,
  "country_code" int,
  "active" boolean,
  PRIMARY KEY ("id", "full_name", "gender")
);

CREATE TABLE "products" (
  "id" int PRIMARY KEY DEFAULT 123,
  "name" varchar DEFAULT 'Tea',
  "merchant_id" int NOT NULL,
  "price" float DEFAULT 123.12,
  "status" varchar DEFAULT NULL,
  "created_at" varchar DEFAULT (now()),
  "stock" boolean DEFAULT true,
  "expiration" date DEFAULT (current_date + interval 1 year)
);


CREATE UNIQUE INDEX ON "users" ("id");

CREATE INDEX "User Name" ON "users" ("full_name");

CREATE INDEX ON "users" USING HASH ("email", "created_at");

CREATE INDEX ON "users" ((now()));

CREATE INDEX ON "users" ("active", ((lower(full_name))));

CREATE INDEX ON "users" (((getdate()), (upper(gender))));

CREATE INDEX ON "users" ((reverse(country_code)));
