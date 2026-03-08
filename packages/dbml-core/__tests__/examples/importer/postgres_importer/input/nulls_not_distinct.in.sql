CREATE TABLE "products" (
  "id" uuid PRIMARY KEY,
  "kind" text NOT NULL,
  "name" text
);

ALTER TABLE ONLY "products"
    ADD CONSTRAINT "products_kind_name_key" UNIQUE NULLS NOT DISTINCT ("kind", "name");
