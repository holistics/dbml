CREATE TABLE "users" (
  "id" int PRIMARY KEY,
  "name" varchar(100),
  "email" varchar(100),
  "age" int,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "count" int DEFAULT 0
);
