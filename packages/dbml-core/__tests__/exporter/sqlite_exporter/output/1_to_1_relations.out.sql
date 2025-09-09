PRAGMA foreign_keys = ON;

CREATE TABLE "father" (
  "obj_id" TEXT UNIQUE PRIMARY KEY
);

CREATE TABLE "child" (
  "obj_id" TEXT UNIQUE PRIMARY KEY,
  "father_obj_id" TEXT,
  FOREIGN KEY ("father_obj_id") REFERENCES "father" ("obj_id")
);
