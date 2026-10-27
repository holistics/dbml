CREATE SCHEMA "users";

CREATE TYPE "users"."job_status" AS ENUM (
  'created',
  'running',
  'done'
);

CREATE TABLE "jobs" (
  "id" integer,
  "status" users.job_status,
  "status_by_name" users.job_status
);
