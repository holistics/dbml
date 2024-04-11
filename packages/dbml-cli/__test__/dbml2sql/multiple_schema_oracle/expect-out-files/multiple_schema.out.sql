CREATE USER "C##test01"
NO AUTHENTICATION
DEFAULT TABLESPACE system
TEMPORARY TABLESPACE temp
QUOTA UNLIMITED ON system;

CREATE USER "C##test02"
NO AUTHENTICATION
DEFAULT TABLESPACE system
TEMPORARY TABLESPACE temp
QUOTA UNLIMITED ON system;

CREATE TABLE "users" (
  "id" int PRIMARY KEY
);

CREATE TABLE "products" (
  "id" int PRIMARY KEY,
  "user_id" int NOT NULL
);

CREATE TABLE "C##test02"."users_products" (
  "users_id" int,
  "products_id" int,
  PRIMARY KEY ("users_id", "products_id")
);

CREATE TABLE "users_products" (
  "users_id" int,
  "products_id" int,
  PRIMARY KEY ("users_id", "products_id")
);

CREATE TABLE "C##test01"."users_products" (
  "users_id" int,
  "products_id" int,
  PRIMARY KEY ("users_id", "products_id")
);

CREATE TABLE "C##test01"."users" (
  "id" int PRIMARY KEY
);

CREATE TABLE "C##test01"."products" (
  "id" int PRIMARY KEY,
  "user_id" int NOT NULL
);

CREATE TABLE "C##test02"."users" (
  "id" int PRIMARY KEY
);

CREATE TABLE "C##test02"."products" (
  "id" int PRIMARY KEY,
  "user_id" int NOT NULL
);

GRANT REFERENCES ON "C##test01"."users" TO PUBLIC;

GRANT REFERENCES ON "users" TO PUBLIC;

GRANT REFERENCES ON "C##test02"."users" TO PUBLIC;

GRANT REFERENCES ON "products" TO PUBLIC;

GRANT REFERENCES ON "C##test02"."products" TO PUBLIC;

ALTER TABLE "products" ADD FOREIGN KEY ("user_id") REFERENCES "C##test01"."users" ("id");

ALTER TABLE "C##test01"."products" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "C##test01"."products" ADD FOREIGN KEY ("user_id") REFERENCES "C##test01"."users" ("id");

ALTER TABLE "C##test02"."users_products" ADD FOREIGN KEY ("users_id") REFERENCES "C##test02"."users" ("id");

ALTER TABLE "C##test02"."users_products" ADD FOREIGN KEY ("products_id") REFERENCES "products" ("id");

ALTER TABLE "users_products" ADD FOREIGN KEY ("users_id") REFERENCES "users" ("id");

ALTER TABLE "users_products" ADD FOREIGN KEY ("products_id") REFERENCES "C##test02"."products" ("id");

ALTER TABLE "C##test01"."users_products" ADD FOREIGN KEY ("users_id") REFERENCES "C##test01"."users" ("id");

ALTER TABLE "C##test01"."users_products" ADD FOREIGN KEY ("products_id") REFERENCES "C##test02"."products" ("id");
