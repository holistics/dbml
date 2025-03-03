CREATE TABLE "user" (
  "user_id" int GENERATED AS IDENTITY PRIMARY KEY,
  "username" varchar2(40) UNIQUE NOT NULL,
  "password" varchar2(255) NOT NULL,
  "email" nvarchar2(40) UNIQUE NOT NULL,
  "role" integer DEFAULT 0,
  "created_date" timestamp DEFAULT current_timestamp
);

CREATE TABLE "category" (
  "cat_id" int GENERATED AS IDENTITY PRIMARY KEY,
  "cat_name" nvarchar2(50) NOT NULL,
  "super_cat_id" int,
  "created_date" timestamp DEFAULT current_timestamp
);

CREATE TABLE "product" (
  "product_id" int GENERATED AS IDENTITY PRIMARY KEY,
  "product_name" nvarchar2(255) NOT NULL,
  "current_price" float NOT NULL,
  "cat_id" int NOT NULL,
  "is_sold" number(1),
  "created_date" timestamp DEFAULT current_timestamp,
  "is_allow_all" number(1)
);

CREATE TABLE "wishlist" (
  "user_id" int NOT NULL,
  "product_id" int NOT NULL,
  PRIMARY KEY ("user_id", "product_id")
);

CREATE INDEX "FULLTEXT_INDEX_CATEGORY" ON "category" ("cat_name");

CREATE INDEX "FULLTEXT_INDEX_PRODUCT" ON "product" ("product_name");

COMMENT ON TABLE "category" IS 'Category is stored as tree like structure';

ALTER TABLE "category" ADD CONSTRAINT "FK_CATEGORY_SUPER" FOREIGN KEY ("super_cat_id") REFERENCES "category" ("cat_id");

ALTER TABLE "product" ADD CONSTRAINT "FK_PRODUCT_CATEGORY" FOREIGN KEY ("cat_id") REFERENCES "category" ("cat_id");

ALTER TABLE "wishlist" ADD CONSTRAINT "FK_WISHLIST_PRODUCT" FOREIGN KEY ("product_id") REFERENCES "product" ("product_id");

ALTER TABLE "wishlist" ADD CONSTRAINT "FK_WISHLIST_USER" FOREIGN KEY ("user_id") REFERENCES "user" ("user_id");
