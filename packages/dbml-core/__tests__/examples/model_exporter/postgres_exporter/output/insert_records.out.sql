CREATE TABLE "users" (
  "id" integer PRIMARY KEY,
  "name" varchar,
  "email" varchar,
  "active" boolean,
  "created_at" timestamp
);

CREATE TABLE "posts" (
  "id" integer PRIMARY KEY,
  "user_id" integer,
  "title" varchar,
  "content" text
);

ALTER TABLE "users" ADD FOREIGN KEY ("id") REFERENCES "posts" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

-- Defer constraint checking for INSERT
BEGIN;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO "users" ("id", "name", "email", "active", "created_at")
VALUES
  (1, 'Alice', 'alice@example.com', TRUE, '2024-01-15 10:30:00'),
  (2, 'Bob', 'bob@example.com', FALSE, '2024-01-16 14:20:00'),
  (3, 'Charlie', NULL, TRUE, '2024-01-17 09:15:00');
INSERT INTO "posts" ("id", "user_id", "title", "content")
VALUES
  (1, 1, 'First Post', 'Hello World'),
  (2, 1, 'Second Post', 'It''s a beautiful day');

SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;