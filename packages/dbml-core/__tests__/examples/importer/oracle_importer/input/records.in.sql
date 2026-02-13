CREATE TABLE "departments" (
  "id" integer PRIMARY KEY,
  "name" nvarchar2(255),
  "budget" "number(10, 2)"
);

-- First INSERT statement
INSERT INTO "departments" ("id", "name", "budget")
VALUES (1, 'Engineering', 500000);

-- Second INSERT statement
INSERT INTO "departments" ("id", "name", "budget")
VALUES (2, 'Marketing', 300000);

-- Third INSERT statement
INSERT INTO "departments" ("id", "name", "budget")
VALUES (3, 'Sales', 400000);

-- Fourth INSERT statement with different column order
INSERT INTO "departments" ("budget", "id", "name")
VALUES (250000, 4, 'HR');

CREATE TABLE "employees" (
  "id" integer PRIMARY KEY,
  "dept_id" integer,
  "name" nvarchar2(255)
);

-- Multiple INSERT statements for employees table
INSERT INTO "employees" ("id", "dept_id", "name")
VALUES (1, 1, 'John Doe');

INSERT INTO "employees" ("id", "dept_id", "name")
VALUES (2, 1, 'Jane Smith');

INSERT INTO "employees" ("id", "dept_id", "name")
VALUES (3, 2, 'Bob Johnson');
