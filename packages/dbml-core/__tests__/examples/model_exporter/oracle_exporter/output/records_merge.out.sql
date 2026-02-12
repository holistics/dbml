CREATE TABLE "departments" (
  "id" integer PRIMARY KEY,
  "name" nvarchar2,
  "budget" number
);

CREATE TABLE "employees" (
  "id" integer PRIMARY KEY,
  "dept_id" integer,
  "name" nvarchar2
);

-- Disable constraint checking for INSERT
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO "departments" ("id", "name", "budget")
VALUES (1, 'Engineering', 500000);
INSERT ALL
  INTO "departments" ("id", "name", "budget") VALUES (2, 'Marketing', 300000)
  INTO "departments" ("id", "name", "budget") VALUES (3, 'Sales', 400000)
SELECT * FROM dual;
INSERT INTO "departments" ("budget", "id", "name")
VALUES (250000, 4, 'HR');
INSERT INTO "employees" ("id", "dept_id", "name")
VALUES (1, 1, 'John Doe');
INSERT ALL
  INTO "employees" ("id", "dept_id", "name") VALUES (2, 1, 'Jane Smith')
  INTO "employees" ("id", "dept_id", "name") VALUES (3, 2, 'Bob Johnson')
SELECT * FROM dual;

SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
