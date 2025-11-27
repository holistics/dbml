CREATE TABLE "gold_users" (
  "id" integer,
  "name" string,
  "age" integer,
  "birthday" "string COLLATE Latin1_General_CS_AS",
  "chilren" integer,
  "amount" integer
);

CREATE TABLE "silver_users" (
  "id" integer,
  "dirty_name" string,
  "dirty_age" integer,
  "children" integer CHECK (aaa)
);

