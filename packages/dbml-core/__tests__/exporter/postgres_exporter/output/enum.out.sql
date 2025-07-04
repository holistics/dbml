CREATE SCHEMA "SchemaName";

CREATE SCHEMA "Schema Name";

CREATE TYPE "UserRoleEnum" AS ENUM (
  'User',
  'Admin'
);

CREATE TYPE "SchemaName"."UserRoleEnum" AS ENUM (
  'User',
  'Admin'
);

CREATE TYPE "Schema Name"."UserRoleEnum" AS ENUM (
  'User',
  'Admin'
);

CREATE TYPE "Schema Name"."User Role Enum" AS ENUM (
  'User',
  'Admin'
);

CREATE TABLE "accounts" (
  "id" int,
  "name" "Var Char",
  "email" VarChar,
  "role" "UserRoleEnum",
  "role3" "Schema Name"."UserRoleEnum",
  "role4" "SchemaName"."UserRoleEnum",
  "role5" "Schema Name"."User Role Enum"
);
