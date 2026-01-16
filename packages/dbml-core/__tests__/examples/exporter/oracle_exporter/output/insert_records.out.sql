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

ALTER TABLE "users" ADD FOREIGN KEY ("id") REFERENCES "posts" ("user_id");

-- Use deferred constraints for INSERT
SET CONSTRAINTS ALL DEFERRED;

INSERT ALL
  INTO "users" ("id", "name", "email", "active", "created_at") VALUES (1, 'Alice', 'alice@example.com', 1, '2024-01-15 10:30:00')
  INTO "users" ("id", "name", "email", "active", "created_at") VALUES (2, 'Bob', 'bob@example.com', 0, '2024-01-16 14:20:00')
  INTO "users" ("id", "name", "email", "active", "created_at") VALUES (3, 'Charlie', NULL, 1, '2024-01-17 09:15:00')
SELECT * FROM dual;
INSERT ALL
  INTO "posts" ("id", "user_id", "title", "content") VALUES (1, 1, 'First Post', 'Hello World')
  INTO "posts" ("id", "user_id", "title", "content") VALUES (2, 1, 'Second Post', 'It''s a beautiful day')
SELECT * FROM dual;

COMMIT;
