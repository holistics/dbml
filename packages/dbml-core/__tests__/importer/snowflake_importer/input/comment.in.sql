CREATE
OR REPLACE DATABASE TEST_DB COMMENT = 'Huy Phung''s test database';

CREATE
OR REPLACE SCHEMA TEST_DB.TEST_SCHEMA COMMENT = 'Huy Phung''s test schema';

CREATE TABLE TEST_DB.TEST_SCHEMA.ONE (
  employee_id INT NOT NULL COMMENT 'Unique identifier for each employee',
  first_name VARCHAR(50) NOT NULL COMMENT 'Employee''s first name',
  last_name VARCHAR(50) NOT NULL COMMENT 'Employee''s last name',
  email VARCHAR(100) COMMENT 'Employee''s work email address',
  hire_date DATE COMMENT 'Date when the employee was hired',
  department VARCHAR(50) COMMENT 'Department where the employee works',
  salary DECIMAL(10,2) COMMENT 'Employee''s annual salary'
)
COMMENT = 'This table stores information about company''s employees'
;

CREATE TABLE TEST_SCHEMA.TWO (
  employee_id INT NOT NULL COMMENT 'Unique identifier for each employee',
  first_name VARCHAR(50) NOT NULL COMMENT 'Employee''s first name',
  last_name VARCHAR(50) NOT NULL COMMENT 'Employee''s last name',
  email VARCHAR(100) COMMENT 'Employee''s work email address',
  hire_date DATE COMMENT 'Date when the employee was hired',
  department VARCHAR(50) COMMENT 'Department where the employee works',
  salary DECIMAL(10,2) COMMENT 'Employee''s annual salary'
)
COMMENT = 'This table stores information about company employees'
COMMENT = 'Another comment for employees table'
;

comment on database d is 'd';
comment on file format f is 'f';
comment on function f is 'f';
comment on function f2(int, number) is 'f';
comment on integration i is 'i';
comment on masking policy m is 'm';
comment on network policy n is 'n';
comment on pipe p is 'p';
comment on procedure p is 'p';
comment on role r is 'r';
comment on row access policy r is 'r';
comment on schema s is 's';
comment on sequence s is 's';
comment on session policy s is 's';
comment on stage s is 's';
comment on stream s is 's';
comment on table t is 't';
comment on tag t is 't';
comment on task t is 't';
comment on user u is 'u';
comment on view v is 'v';
comment on warehouse w is 'w';
comment on column t.c IS 't.c';
comment on column s.t.c IS 's.t.c';
comment on column d.s.t.c IS 'd.s.t.c';