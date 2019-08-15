CREATE TABLE "users" (
  "id" int PRIMARY KEY,
  "full_name" varchar,
  "email" varchar UNIQUE,
  "gender" varchar,
  "date_of_birth" varchar,
  "created_at" varchar,
  "country_code" int,
  "active" boolean
);

CREATE UNIQUE INDEX ON "users" ("id");

CREATE INDEX "User Name" ON "users" ("full_name");

CREATE INDEX ON "users" USING HASH ("email", "created_at");

CREATE INDEX ON "users" ((now()));

CREATE INDEX ON "users" ("active", (lower(full_name)));

CREATE INDEX ON "users" ((getdate()), (upper(gender)));

CREATE INDEX ON "users" ((reverse(country_code)));
