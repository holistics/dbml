CREATE TYPE "orders_status" AS ENUM (
  'created',
  'running',
  'done',
  'failure'
);

CREATE TYPE "product status" AS ENUM (
  'Out of Stock',
  'In Stock'
);

CREATE TABLE "orders" (
  "id" SERIAL PRIMARY KEY,
  "user_id" int UNIQUE NOT NULL,
  "status" orders_status,
  "created_at" varchar,
  "modified_at" timestamp(2)
);

CREATE TABLE "order_items" (
  "order_id" int,
  "product_id" int,
  "quantity" int DEFAULT 1,
  "created_at" timestamp with time zone,
  "modified_at" time with time zone
);

CREATE TABLE "products" (
  "id" int,
  "name" varchar,
  "merchant_id" int NOT NULL,
  "price" int,
  "status" "product status",
  "created_at" datetime DEFAULT (now()),
  "modified_at" timestamp without time zone,
  PRIMARY KEY ("id", "name")
);

CREATE TABLE "users" (
  "id" int PRIMARY KEY,
  "full_name" varchar,
  "email" varchar UNIQUE,
  "gender" varchar,
  "date_of_birth" varchar,
  "created_at" varchar,
  "modified_at" time(2),
  "country_code" int
);

CREATE TABLE "merchants" (
  "id" int PRIMARY KEY,
  "merchant_name" varchar,
  "country_code" int,
  "created_at" varchar,
  "modified_at" time without time zone,
  "admin_id" int
);

CREATE TABLE "countries" (
  "code" int PRIMARY KEY,
  "name" varchar,
  "continent_name" varchar
);

CREATE TABLE "foo" (
  "bar" text[],
  "bar2" int [ 1 ],
  "bar3" int[2][3 ],
  "bar4" int array,
  "bar5" int ARRAY [2],
  "bar6" text ARRAY[8],
  "bar7" text ARRAY[ 100 ],
  "bar8" time(2) with time zone [],
  "bar9" time(1) [1],
  "bar10" time(1) aRRay,
  "bar11" time aRray [5],
  "bar12" timestamp(2) without time zone[10][2][5],
  "bar13" character varying[],
  "bar14" character varying(25) [][2][],
  "bar15" character varying array [76]
);

ALTER TABLE "order_items" ADD FOREIGN KEY ("order_id") REFERENCES "orders" ("id");

ALTER TABLE "order_items" ADD FOREIGN KEY ("product_id") REFERENCES "products" ("id");

ALTER TABLE "users" ADD FOREIGN KEY ("country_code") REFERENCES "countries" ("code");

ALTER TABLE "merchants" ADD FOREIGN KEY ("country_code") REFERENCES "countries" ("code");

ALTER TABLE "products" ADD FOREIGN KEY ("merchant_id") REFERENCES "merchants" ("id");

ALTER TABLE "merchants" ADD FOREIGN KEY ("admin_id") REFERENCES "users" ("id");

CREATE INDEX "product_status" ON "products" ("merchant_id", "status");

CREATE UNIQUE INDEX ON "products" USING HASH ("id");

COMMENT ON TABLE "users" IS 'User data';

COMMENT ON TABLE "users" IS 'Store user data';

COMMENT ON TABLE "products" IS 'Products table comment';

-- https://github.com/holistics/dbml/issues/324
CREATE TABLE "public"."accounts" (
  "id" integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  "domain" character varying(100),
  "name" character varying(100),
  "slug" character varying(10),
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
) WITH (oids = false);

-- https://github.com/holistics/dbml/issues/281
CREATE TABLE public.tests ( id bigint NOT NULL, type character varying DEFAULT 'testing'::character varying );

-- https://github.com/holistics/dbml/issues/427
CREATE TABLE public.users2 (
    username character varying NOT NULL,
    hashed_password character varying NOT NULL,
    full_name character varying NOT NULL,
    email character varying NOT NULL,
    password_changed_at timestamp with time zone DEFAULT '0001-01-01 00:00:00+00'::timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- https://github.com/holistics/dbml/issues/248
create table table1 (
    field text not null,
    field2 text not null,
    primary key(field, field2)
);

create table if not exists table2 (
    id int generated always as identity primary key,
    field text,
    field2 text,
    foreign key (field, field2) references table1(field, field2)
);

-- https://github.com/holistics/dbml/issues/222
CREATE TABLE test_table (
	"name" varchar NOT NULL,
	id varchar NULL,
	linked_name varchar NOT NULL,
	CONSTRAINT test_table_pk PRIMARY KEY ("name", id),
	CONSTRAINT test_table_fk FOREIGN KEY (linked_name,id) REFERENCES test_table("name",id)
);
