PRAGMA foreign_keys = ON;

CREATE TABLE "a" (
  "AB" INTEGER,
  "BA" INTEGER,
  PRIMARY KEY ("AB","BA")
);

CREATE TABLE "b" (
  "BC" INTEGER,
  "CB" INTEGER,
  PRIMARY KEY ("BC","CB")
);

CREATE TABLE "c" (
  "CD" INTEGER PRIMARY KEY,
  "DC" INTEGER
);

CREATE TABLE "d" (
  "DE" INTEGER PRIMARY KEY,
  "ED" INTEGER
);

CREATE TABLE "e" (
  "EF" INTEGER,
  "FE" INTEGER,
  "DE" INTEGER,
  "ED" INTEGER,
  PRIMARY KEY ("EF","FE")
);

CREATE TABLE "g" (
  "GH" INTEGER,
  "HG" INTEGER,
  "EH" INTEGER,
  "HE" INTEGER,
  PRIMARY KEY ("GH","HG")
);

CREATE TABLE "t1" (
  "a" INTEGER PRIMARY KEY,
  "b" INTEGER UNIQUE
);

CREATE TABLE "t2" (
  "a" INTEGER PRIMARY KEY,
  "b" INTEGER UNIQUE
);

CREATE TABLE "t1_t2" (
  "a" INTEGER
);

CREATE TABLE "image" (
  "id" INTEGER PRIMARY KEY,
  "url" TEXT
);

CREATE TABLE "content_item" (
  "id" INTEGER PRIMARY KEY,
  "heading" TEXT,
  "description" TEXT
);

CREATE TABLE "footer_item" (
  "id" INTEGER PRIMARY KEY,
  "left" TEXT,
  "centre" TEXT,
  "right" TEXT
);

CREATE TABLE "customers" (
  "id" INTEGER PRIMARY KEY,
  "full_name" TEXT
);

CREATE TABLE "orders" (
  "id" INTEGER PRIMARY KEY,
  "total_price" INTEGER
);

CREATE TABLE "d_c" (
  "d_DE" INTEGER,
  "c_CD" INTEGER,
  PRIMARY KEY ("d_DE","c_CD"),
  FOREIGN KEY ("d_DE") REFERENCES "d" ("DE"),
  FOREIGN KEY ("c_CD") REFERENCES "c" ("CD")
);

CREATE TABLE "a_b" (
  "a_AB" INTEGER,
  "a_BA" INTEGER,
  "b_BC" INTEGER,
  "b_CB" INTEGER,
  PRIMARY KEY ("a_AB","a_BA","b_BC","b_CB"),
  FOREIGN KEY ("a_AB","a_BA") REFERENCES "a" ("AB","BA"),
  FOREIGN KEY ("b_BC","b_CB") REFERENCES "b" ("BC","CB")
);

CREATE TABLE "e_g" (
  "e_EF" INTEGER,
  "e_FE" INTEGER,
  "g_GH" INTEGER,
  "g_HG" INTEGER,
  PRIMARY KEY ("e_EF","e_FE","g_GH","g_HG"),
  FOREIGN KEY ("e_EF","e_FE") REFERENCES "e" ("EF","FE"),
  FOREIGN KEY ("g_GH","g_HG") REFERENCES "g" ("GH","HG")
);

CREATE TABLE "t1_t2(1)" (
  "t1_a" INTEGER,
  "t2_a" INTEGER,
  PRIMARY KEY ("t1_a","t2_a"),
  FOREIGN KEY ("t1_a") REFERENCES "t1" ("a"),
  FOREIGN KEY ("t2_a") REFERENCES "t2" ("a")
);

CREATE TABLE "t1_t2(2)" (
  "t1_b" INTEGER,
  "t2_b" INTEGER,
  PRIMARY KEY ("t1_b","t2_b"),
  FOREIGN KEY ("t1_b") REFERENCES "t1" ("b"),
  FOREIGN KEY ("t2_b") REFERENCES "t2" ("b")
);

CREATE TABLE "image_content_item" (
  "image_id" INTEGER,
  "content_item_id" INTEGER,
  PRIMARY KEY ("image_id","content_item_id"),
  FOREIGN KEY ("image_id") REFERENCES "image" ("id"),
  FOREIGN KEY ("content_item_id") REFERENCES "content_item" ("id")
);

CREATE TABLE "customers_orders" (
  "customers_id" INTEGER,
  "orders_id" INTEGER,
  PRIMARY KEY ("customers_id","orders_id"),
  FOREIGN KEY ("customers_id") REFERENCES "customers" ("id"),
  FOREIGN KEY ("orders_id") REFERENCES "orders" ("id")
);
