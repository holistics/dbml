CREATE TYPE "job_status" AS ENUM (
  'created',
  'running',
  'done',
  'failed',
  'wait for validation'
);

CREATE TABLE "jobs" (
  "id" integer PRIMARY KEY,
  "status" "job_status"
);

CREATE TABLE IF NOT EXISTS orders (
  id int PRIMARY KEY,
  created_at varchar,
  priority "priority enum",
  "status" order_status
);

CREATE TYPE order_status AS ENUM(
  'pending',
  'processing',
  'done'
);

CREATE TYPE "priority enum" AS ENUM (
  'low',
  'medium',
  'high'
);