CREATE TYPE "job_status" AS ENUM (
  'created',
  'running',
  'done',
  'failed',
  'wait for validation'
);

CREATE TYPE "order_status" AS ENUM (
  'pending',
  'processing',
  'done'
);

CREATE TYPE "priority enum" AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TABLE "jobs" (
  "id" integer PRIMARY KEY,
  "status" job_status
);

CREATE TABLE "orders" (
  "id" int PRIMARY KEY,
  "created_at" varchar,
  "priority" "priority enum",
  "status" order_status
);
