CREATE TABLE "employees" (
  "employee_id" number GENERATED AS IDENTITY PRIMARY KEY,
  "email" varchar2(100) UNIQUE NOT NULL,
  "first_name" nvarchar2(50) DEFAULT 'Unknown' NOT NULL,
  "last_name" nvarchar2(50) NOT NULL,
  "middle_name" varchar2(50) DEFAULT '',
  "department" varchar2(30) DEFAULT 'General' UNIQUE NOT NULL,
  "years_of_service" integer DEFAULT 0 NOT NULL,
  "employee_rank" number(2) DEFAULT 1 UNIQUE NOT NULL,
  "hire_date" date DEFAULT SYSDATE NOT NULL,
  "last_review_date" timestamp DEFAULT current_timestamp,
  "termination_date" date,
  "birth_date" date NOT NULL,
  "is_active" number(1) DEFAULT 1 NOT NULL,
  "is_manager" number(1) DEFAULT 0,
  "notes" clob,
  "profile_data" nclob DEFAULT '{}'
);

CREATE TABLE "projects" (
  "project_id" int GENERATED AS IDENTITY PRIMARY KEY,
  "project_code" varchar2(20) UNIQUE NOT NULL,
  "project_name" nvarchar2(100) DEFAULT 'Unnamed Project' NOT NULL,
  "start_date" date DEFAULT SYSDATE NOT NULL,
  "end_date" date,
  "status" varchar2(20) DEFAULT 'PLANNED' NOT NULL,
  "priority" integer DEFAULT 999 UNIQUE
);
