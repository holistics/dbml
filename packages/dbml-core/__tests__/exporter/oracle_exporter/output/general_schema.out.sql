CREATE TABLE "user" (
  "user_id" int GENERATED AS IDENTITY PRIMARY KEY,
  "username" varchar2(40) UNIQUE NOT NULL,
  "password" varchar2(255) NOT NULL,
  "email" nvarchar2(40) UNIQUE NOT NULL,
  "address" nvarchar2(255),
  "role" integer DEFAULT 0,
  "first_name" nvarchar2(20) NOT NULL,
  "last_name" nvarchar2(30) NOT NULL,
  "seller_expired_date" timestamp,
  "created_date" timestamp DEFAULT current_timestamp
);

CREATE TABLE "rating" (
  "rating_id" int GENERATED AS IDENTITY PRIMARY KEY,
  "rated_user_id" int NOT NULL,
  "evaluator_id" int NOT NULL,
  "feedback" nclob NOT NULL,
  "is_positive" number(1) NOT NULL,
  "rated_at" timestamp DEFAULT current_timestamp
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
  "buy_now_price" float,
  "expired_date" timestamp NOT NULL,
  "cat_id" int NOT NULL,
  "max_tolerable_price" float,
  "is_sold" number(1),
  "won_bidder_id" int,
  "current_bidding_count" int DEFAULT 0,
  "created_date" timestamp DEFAULT current_timestamp,
  "is_allow_all" number(1)
);

CREATE TABLE "product_detail" (
  "product_id" int GENERATED AS IDENTITY PRIMARY KEY,
  "step_price" int NOT NULL,
  "auto_extend" number(1) DEFAULT 0,
  "image_links" nclob NOT NULL,
  "description" nclob NOT NULL,
  "seller_id" int NOT NULL
);

CREATE TABLE "wishlist" (
  "user_id" int NOT NULL,
  "product_id" int NOT NULL,
  PRIMARY KEY ("user_id", "product_id")
);

CREATE INDEX "FULLTEXT_INDEX_CATEGORY" ON "category" ("cat_name");

CREATE INDEX "FULLTEXT_INDEX_PRODUCT" ON "product" ("product_name");

COMMENT ON COLUMN "rating"."rating_id" IS 'Ignore not null when using increment';

COMMENT ON COLUMN "rating"."is_positive" IS 'Number(1) represents for boolean';

COMMENT ON TABLE "category" IS 'Category is stored as tree like structure';

ALTER TABLE "rating" ADD CONSTRAINT "FK_RATED_USER_ACOUNT" FOREIGN KEY ("rated_user_id") REFERENCES "user" ("user_id");

ALTER TABLE "rating" ADD CONSTRAINT "FK_EVALUATOR_USER" FOREIGN KEY ("evaluator_id") REFERENCES "user" ("user_id");

ALTER TABLE "category" ADD CONSTRAINT "FK_CATEGORY_SUPER" FOREIGN KEY ("super_cat_id") REFERENCES "category" ("cat_id");

ALTER TABLE "product" ADD CONSTRAINT "FK_PRODUCT_CATEGORY" FOREIGN KEY ("cat_id") REFERENCES "category" ("cat_id");

ALTER TABLE "product" ADD CONSTRAINT "FK_PRODUCT_USER" FOREIGN KEY ("won_bidder_id") REFERENCES "user" ("user_id");

ALTER TABLE "product_detail" ADD CONSTRAINT "FK_PRODUCT_DETAIL_PRODUCT" FOREIGN KEY ("product_id") REFERENCES "product" ("product_id");

ALTER TABLE "product_detail" ADD CONSTRAINT "FK_PRODUCT_DETAIL_USER" FOREIGN KEY ("seller_id") REFERENCES "user" ("user_id");

ALTER TABLE "wishlist" ADD CONSTRAINT "FK_WISHLIST_PRODUCT" FOREIGN KEY ("product_id") REFERENCES "product" ("product_id");

ALTER TABLE "wishlist" ADD CONSTRAINT "FK_WISHLIST_USER" FOREIGN KEY ("user_id") REFERENCES "user" ("user_id");
