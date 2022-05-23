CREATE TABLE "authors" (
  "id" int PRIMARY KEY,
  "name" varchar,
  "dob" date,
  "gender" varchar
);

CREATE TABLE "books" (
  "id" int PRIMARY KEY,
  "release_date" date,
  "title" varchar
);

CREATE TABLE "authors_books" (
  "authors_id" int NOT NULL,
  "books_id" int NOT NULL,
  CONSTRAINT PK_authors_books PRIMARY KEY ("authors_id", "books_id")
);

ALTER TABLE "authors_books" ADD FOREIGN KEY ("authors_id") REFERENCES "authors" ("id");

ALTER TABLE "authors_books" ADD FOREIGN KEY ("books_id") REFERENCES "books" ("id");

