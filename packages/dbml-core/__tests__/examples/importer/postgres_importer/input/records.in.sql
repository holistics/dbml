CREATE TABLE "users" (
  "id" integer PRIMARY KEY,
  "name" varchar(255),
  "email" varchar(255),
  "active" boolean
);

-- First INSERT statement
INSERT INTO "users" ("id", "name", "email", "active")
VALUES
  (1, 'Alice', 'alice@example.com', TRUE),
  (2, 'Bob', 'bob@example.com', FALSE);

-- Second INSERT statement for the same table
INSERT INTO "users" ("id", "name", "email", "active")
VALUES
  (3, 'Charlie', 'charlie@example.com', TRUE);

-- Third INSERT statement with different column subset
INSERT INTO "users" ("id", "email", "active", "name")
VALUES
  (4, 'dave@example.com', FALSE, 'Dave');

CREATE TABLE "comments" (
  "id" integer PRIMARY KEY,
  "user_id" integer,
  "content" text
);

-- Multiple INSERT statements for comments table
INSERT INTO "comments" ("id", "user_id", "content")
VALUES
  (1, 1, 'Great post!');

INSERT INTO "comments" ("id", "user_id", "content")
VALUES
  (2, 2, 'Nice article'),
  (3, 1, 'Thanks for sharing');
