-- Create customers table
CREATE TABLE customers (
    customer_id INT,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100),
    registration_date DATE
);

-- Create orders table
CREATE TABLE orders (
    order_id INT,
    customer_id INT,
    order_date DATE,
    total_amount DECIMAL(10,2)
);

-- Create employees table
CREATE TABLE employees (
    employee_id INT,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    hire_date DATE,
    department VARCHAR(50)
);

-- Add constraints to customers table
ALTER TABLE customers
ADD CONSTRAINT pk_customer PRIMARY KEY (customer_id);

ALTER TABLE customers
ALTER COLUMN first_name SET NOT NULL;

ALTER TABLE customers
ALTER COLUMN last_name SET NOT NULL;

ALTER TABLE customers
ADD CONSTRAINT uq_customer_email UNIQUE (email);

-- Add constraints to orders table
ALTER TABLE orders
ADD CONSTRAINT pk_order PRIMARY KEY (order_id);

ALTER TABLE orders
ADD CONSTRAINT fk_order_customer
FOREIGN KEY (customer_id) REFERENCES customers(customer_id);

ALTER TABLE orders
ALTER COLUMN order_date SET NOT NULL;

-- Add constraints to employees table
ALTER TABLE employees
ADD CONSTRAINT pk_employee PRIMARY KEY (employee_id);

ALTER TABLE employees
ALTER COLUMN first_name SET NOT NULL;

ALTER TABLE employees
ALTER COLUMN last_name SET NOT NULL;

ALTER TABLE employees
ALTER COLUMN hire_date SET NOT NULL;

alter account a drop old url;
alter api integration ai set enabled = false;
alter connection c primary;
alter database d RENAME TO d2;
alter external table et refresh;
alter failover group fg rename to fg2;
alter file format ff RENAME TO ff2;
alter function f() RENAME TO f2;
alter masking policy mp rename to mp2;
alter materialized view mv rename to mv2;
alter network policy np rename to np2;
alter notification integration ni set enabled = false notification_provider = gcp_pubsub gcp_pubsub_subscription_name = '';
alter pipe p REFRESH ;
alter procedure pr() RENAME TO p2;
alter replication group rg rename to rg2;
alter resource monitor rm set credit_quota = 1;
alter role r RENAME TO r2;
alter row access policy rap rename to rap2;
alter schema sch rename to sch2;
alter security integration si set enabled = true;
-- alter security integration snowflake oauth ;
-- alter security integration saml2 ;
-- alter security integration scim ;
alter sequence seq rename to seq2;
alter session set autocommit = true;
alter share sh unset comment;
alter stage stg rename to stg2;
alter storage integration si set enabled = true;
alter stream st unset comment ;
alter table t rename to t2;
alter table t drop c;
alter tag tg rename to tg2;
alter task ts suspend ;
alter user u reset password ;
alter view vw set secure ;
alter warehouse wh suspend ;
alter sequence seq set ORDER COMMENT ='A comment';
alter sequence seq set NOORDER;
ALTER TABLE  TESTSEED ADD ident int IDENTITY START = 2 INCREMENT BY 1;

ALTER TABLE t ADD COLUMN c2 INTEGER NULL DEFAULT NULL COMMENT 'text';
ALTER TABLE t ADD COLUMN c2 INTEGER NULL NULL COMMENT 'text';
ALTER TABLE t ADD COLUMN c2 INTEGER NULL NOT NULL COMMENT 'text'; --Seems to not make sense but Snowflake accept it but do nothing
--ALTER TABLE t ADD COLUMN c2 INTEGER NULL 1 COMMENT 'text'; This fail in Snowflake