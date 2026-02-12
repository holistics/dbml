CREATE TABLE "users" (
  "id" integer PRIMARY KEY,
  "name" varchar,
  "email" varchar,
  "active" boolean
);

CREATE TABLE "comments" (
  "id" integer PRIMARY KEY,
  "user_id" integer,
  "content" text
);

-- Defer constraint checking for INSERT
BEGIN;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO "users" ("id", "name", "email", "active")
VALUES
  (1, 'Alice', 'alice@example.com', TRUE),
  (2, 'Bob', 'bob@example.com', FALSE);
INSERT INTO "users" ("id", "name", "email", "active")
VALUES
  (3, 'Charlie', 'charlie@example.com', TRUE);
INSERT INTO "users" ("id", "email", "active", "name")
VALUES
  (4, 'dave@example.com', FALSE, 'Dave');
INSERT INTO "comments" ("id", "user_id", "content")
VALUES
  (1, 1, 'Great post!');
INSERT INTO "comments" ("id", "user_id", "content")
VALUES
  (2, 2, 'Nice article'),
  (3, 1, 'Thanks for sharing');

SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
