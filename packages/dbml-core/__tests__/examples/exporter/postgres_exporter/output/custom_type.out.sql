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
  "role" "UserRoleEnum",
  "role3" "Schema Name"."UserRoleEnum",
  "role4" "SchemaName"."UserRoleEnum",
  "role5" "Schema Name"."User Role Enum",
  "field_keyword" "user",
  "field_keyword_quoted" "user",
  "field_keyword_dot" "user"."e",
  "field_keyword_dot_quoted" "user"."e",
  "field_builtin_capitalized" Int,
  "field_builtin_capitalized_quoted" Int,
  "field_builtin_uppercase" INT,
  "field_builtin_uppercase_quoted" INT,
  "field_custom_with_schema" "Random"."Rand",
  "field_custom_with_schema_quoted" "Random"."Rand",
  "field_keyword_capitalized" "User",
  "field_keyword_capitalized_quoted" "User",
  "field_keyword_uppercase" "USER",
  "field_keyword_uppercase_quoted" "USER"
);
