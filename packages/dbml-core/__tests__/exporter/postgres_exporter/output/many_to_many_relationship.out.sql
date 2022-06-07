CREATE SCHEMA "A";

CREATE SCHEMA "B";

CREATE SCHEMA "C";

CREATE SCHEMA "D";

CREATE SCHEMA "E";

CREATE SCHEMA "G";

CREATE TABLE "A"."a" (
  "AB" integer,
  "BA" integer,
  PRIMARY KEY ("AB", "BA")
);

CREATE TABLE "B"."b" (
  "BC" integer,
  "CB" integer,
  PRIMARY KEY ("BC", "CB")
);

CREATE TABLE "C"."c" (
  "CD" integer PRIMARY KEY,
  "DC" integer
);

CREATE TABLE "D"."d" (
  "DE" integer PRIMARY KEY,
  "ED" integer
);

CREATE TABLE "E"."e" (
  "EF" integer,
  "FE" integer,
  "DE" integer,
  "ED" integer,
  PRIMARY KEY ("EF", "FE")
);

CREATE TABLE "G"."g" (
  "GH" integer,
  "HG" integer,
  "EH" integer,
  "HE" integer,
  PRIMARY KEY ("GH", "HG")
);

CREATE TABLE "t1" (
  "a" int,
  "b" int
);

CREATE TABLE "t2" (
  "a" int,
  "b" int
);

CREATE TABLE "t1_t2" (
  "a" int
);

CREATE TABLE "a_b" (
  "a_AB" integer,
  "a_BA" integer,
  "b_BC" integer,
  "b_CB" integer,
  PRIMARY KEY ("a_AB", "a_BA", "b_BC", "b_CB")
);

ALTER TABLE "a_b" ADD FOREIGN KEY ("a_AB", "a_BA") REFERENCES "A"."a" ("AB", "BA");

ALTER TABLE "a_b" ADD FOREIGN KEY ("b_BC", "b_CB") REFERENCES "B"."b" ("BC", "CB");


CREATE TABLE "d_c" (
  "d_DE" integer,
  "c_CD" integer,
  PRIMARY KEY ("d_DE", "c_CD")
);

ALTER TABLE "d_c" ADD FOREIGN KEY ("d_DE") REFERENCES "D"."d" ("DE");

ALTER TABLE "d_c" ADD FOREIGN KEY ("c_CD") REFERENCES "C"."c" ("CD");


CREATE TABLE "e_g" (
  "e_EF" integer,
  "e_FE" integer,
  "g_GH" integer,
  "g_HG" integer,
  PRIMARY KEY ("e_EF", "e_FE", "g_GH", "g_HG")
);

ALTER TABLE "e_g" ADD FOREIGN KEY ("e_EF", "e_FE") REFERENCES "E"."e" ("EF", "FE");

ALTER TABLE "e_g" ADD FOREIGN KEY ("g_GH", "g_HG") REFERENCES "G"."g" ("GH", "HG");


CREATE TABLE "t1_t2(1)" (
  "t1_a" int,
  "t2_a" int,
  PRIMARY KEY ("t1_a", "t2_a")
);

ALTER TABLE "t1_t2(1)" ADD FOREIGN KEY ("t1_a") REFERENCES "t1" ("a");

ALTER TABLE "t1_t2(1)" ADD FOREIGN KEY ("t2_a") REFERENCES "t2" ("a");


CREATE TABLE "t1_t2(2)" (
  "t1_b" int,
  "t2_b" int,
  PRIMARY KEY ("t1_b", "t2_b")
);

ALTER TABLE "t1_t2(2)" ADD FOREIGN KEY ("t1_b") REFERENCES "t1" ("b");

ALTER TABLE "t1_t2(2)" ADD FOREIGN KEY ("t2_b") REFERENCES "t2" ("b");

