CREATE TABLE "products" (
  "sku" character varying(64) NOT NULL,
  "note" character varying(500) DEFAULT ('n/a'::character varying),
  "price" numeric(10,2),
  "tags" character varying(20)[],
  "created_at" timestamp(3) with time zone
);
