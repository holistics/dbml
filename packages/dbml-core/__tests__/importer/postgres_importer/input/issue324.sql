CREATE TABLE "public"."accounts" (
  "id" integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  "domain" character varying(100),
  "name" character varying(100),
  "slug" character varying(10),
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
) WITH (oids = false);