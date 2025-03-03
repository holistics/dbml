CREATE
OR REPLACE TRANSIENT DATABASE TEST_DB COMMENT = 'test database with TRANSIENT storage type';

CREATE
OR REPLACE TRANSIENT SCHEMA TEST_DB.HP_TEST COMMENT = 'Use to test SNOWFLAKE DDL importer';

CREATE
OR REPLACE TRANSIENT TABLE TEST_DB.HP_TEST.CUSTOMERS (
  CUSTOMER_ID NUMBER(38, 0) NOT NULL AUTOINCREMENT START 1 INCREMENT 1 NOORDER,
  FIRST_NAME VARCHAR(50) DEFAULT 'John' NOT NULL,
  LAST_NAME VARCHAR(50) DEFAULT 'Doe' NOT NULL,
  EMAIL VARCHAR(100),
  SECOND_EMAIL VARCHAR(100),
  UNIQUE_NAME VARCHAR(100) NOT NULL DEFAULT CONCAT(FIRST_NAME, LAST_NAME, EMAIL) UNIQUE,
  IS_VIP BOOLEAN DEFAULT FALSE,
  IS_SOMETHING BOOLEAN DEFAULT NULL,
  CREATED_AT TIMESTAMP_NTZ(9) DEFAULT CURRENT_TIMESTAMP(),
  UNIQUE (EMAIL, SECOND_EMAIL),
  PRIMARY KEY (CUSTOMER_ID)
);

CREATE
OR REPLACE TRANSIENT TABLE TEST_DB.HP_TEST.ORDERS (
  ORDER_ID NUMBER(38, 0) NOT NULL AUTOINCREMENT START 1 INCREMENT 1 NOORDER PRIMARY KEY,
  CUSTOMER_ID NUMBER(38, 0),
  ORDER_DATE TIMESTAMP_NTZ(9) DEFAULT CURRENT_TIMESTAMP(),
  TOTAL_AMOUNT NUMBER(10, 2) DEFAULT 0.0,
  FOREIGN KEY (CUSTOMER_ID) REFERENCES TEST_DB.HP_TEST.CUSTOMERS(CUSTOMER_ID)
);

CREATE
OR REPLACE TRANSIENT TABLE TEST_DB.HP_TEST.ORDER_ITEMS (
  ORDER_ITEM_ID NUMBER(38, 0) NOT NULL AUTOINCREMENT START 1 INCREMENT 1 NOORDER PRIMARY KEY UNIQUE,
  ORDER_ID NUMBER(38, 0) FOREIGN KEY REFERENCES TEST_DB.HP_TEST.ORDERS(ORDER_ID),
  PRODUCT_ID NUMBER(38, 0),
  QUANTITY NUMBER(38, 0) DEFAULT 1,
  PRICE NUMBER(10, 2),
  FOREIGN KEY (PRODUCT_ID) REFERENCES TEST_DB.HP_TEST.PRODUCTS(PRODUCT_ID)
);

CREATE
OR REPLACE TRANSIENT TABLE TEST_DB.HP_TEST.PRODUCTS (
  PRODUCT_ID NUMBER(38, 0) NOT NULL AUTOINCREMENT START 1 INCREMENT 1 NOORDER,
  PRODUCT_NAME VARCHAR(100),
  DESCRIPTION VARCHAR(16777216),
  PRICE NUMBER(10, 2),
  STOCK_QUANTITY NUMBER(38, 0),
  PRIMARY KEY (PRODUCT_ID)
);

CREATE OR REPLACE TRANSIENT TABLE TEST_DB.HP_TEST.COMPOSITE_PK_TABLE (
  COLUMN1 NUMBER(38,0) NOT NULL,
  COLUMN2 VARCHAR(16777216) NOT NULL,
  COLUMN3 DATE,
  CONSTRAINT PK_COMPOSITE PRIMARY KEY (COLUMN1, COLUMN2)
);

CREATE
OR REPLACE TRANSIENT SCHEMA TEST_DB.PUBLIC;

CREATE
OR REPLACE TRANSIENT SCHEMA TEST_DB.TEST;

CREATE
OR REPLACE TRANSIENT TABLE TEST_DB.TEST."_holistics_persisted_test_20240703094645" (
  "a" NUMBER(1, 0),
  "b" NUMBER(1, 0),
  "c" NUMBER(1, 0)
);

CREATE
OR REPLACE TRANSIENT SCHEMA TEST_DB.TEST_2024_06_05_06_33_IZJGOY;

CREATE
OR REPLACE TRANSIENT SCHEMA TEST_DB.TEST_2024_06_11_11_08_YIEA7S;

CREATE
OR REPLACE TRANSIENT SCHEMA TEST_DB.TEST_2024_06_12_05_55_UNUEMX;

CREATE
OR REPLACE TRANSIENT SCHEMA TEST_DB.TEST_2024_06_19_03_15_DE01TD;

CREATE
OR REPLACE TRANSIENT SCHEMA TEST_DB.TEST_2024_06_28_10_01_ZQMIMY;

CREATE
OR REPLACE TRANSIENT TABLE TEST_DB.TEST_2024_06_28_10_01_ZQMIMY.ONE (
  FOO VARCHAR(16777216),
  BAR VARCHAR(16777216),
  CONSTRAINT PKEY_FOO PRIMARY KEY (FOO),
  CONSTRAINT UNIQUE_BAR UNIQUE (BAR),
  CONSTRAINT UNIQUE_FOO_BAR UNIQUE (FOO, BAR),
  CONSTRAINT UNIQUE_BAR_FOO UNIQUE (BAR, FOO)
);

CREATE
OR REPLACE TRANSIENT TABLE TEST_DB.TEST_2024_06_28_10_01_ZQMIMY.TWO (
  ABC VARCHAR(16777216),
  XYZ VARCHAR(16777216),
  QWE VARCHAR(16777216),
  CONSTRAINT FKEY_ABC_XYZ FOREIGN KEY (XYZ, ABC) REFERENCES TEST_DB.TEST_2024_06_28_10_01_ZQMIMY."ONE"(BAR, FOO),
  CONSTRAINT FKEY_QWE FOREIGN KEY (QWE) REFERENCES TEST_DB.TEST_2024_06_28_10_01_ZQMIMY."ONE"(FOO),
  CONSTRAINT UNIQUE_QWE_ABC UNIQUE (QWE, ABC)
);

CREATE
OR REPLACE TRANSIENT SCHEMA TEST_DB.TEST_2024_07_03_09_46_3ARLDM;

CREATE TABLE TEST_DB.HP_TEST.CLONE_ORDERS LIKE TEST_DB.HP_TEST.ORDERS;

CREATE TABLE TEST_DB.HP_TEST.employees (
  employee_id INT PRIMARY KEY AUTOINCREMENT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NULL,
  hire_date DATE DEFAULT CURRENT_DATE()
);

--Keyword tester
CREATE TABLE TESTKEYWORD(IFNULL int, NVL int, GET int, LEFT int,RIGHT int, DATE_PART int,TO_DATE int,DATE int,SPLIT int,NULLIF int,EQUAL_NULL int );

create temporary table t(i int);
create table t1 (v varchar(16777216));
create table t2(i int) as select(i) from t;
create table t3 as select(i) from t;

create table t4 (v varchar(16777216) comment 'hello world');
create table t5 (v varchar(16777216) not null comment 'hello world');
create table t6 (v varchar(32) not null unique comment 'hello world');
create table t7 (i integer default 1 comment 'hello world');

create table t8 (i integer tag (t='t'));
create table t9 (i integer tag (s.t='s.t'));
create table t10 (i integer tag (d.s.t='d.s.t'));

-- -- Default, collate, not null, and inline constraints can be in any order
create table t_default_1 (i integer not null);
create table t_default_2 (i integer not null unique);
create table t_default_3 (i integer unique not null);
create table t_default_4 (i integer primary key not null);
create table t_default_5 (i integer primary key unique not null);
create table t_default_6 (i integer not null unique primary key);
create table t_default_7 (i integer not null default 1);
create table t_default_8 (i integer default 1 not null);
create table t_default_9 (i integer not null autoincrement);
create table t_default_10 (i integer autoincrement not null);
create table t_default_11 (v varchar(32) not null collate 'upper');
create table t_default_12 (v varchar(32) collate 'upper' not null);
create table t_default_13 (v varchar(32) unique collate 'upper' not null);
create table t_default_14 (v varchar(32) collate 'upper' unique not null);
create table t_default_15 (v varchar(32) collate 'upper' default 'hey');
create table t_default_16 (v varchar(32) unique collate 'upper' default 'hey');
create table t_default_17 (v varchar(32) default 'hey' unique collate 'upper');
create table t_default_18 (v varchar(32) default 'hey' primary key collate 'upper');

create or replace table t_masking_1 (i integer masking policy m);
create or replace table t_masking_2 (i integer masking policy m tag (t='t'));

create table t_policy_1 (i integer default 1 not null unique masking policy m tag (t='t') comment 'hello world');
create table t_policy_2 (v varchar unique not null collate 'upper' masking policy m tag (t='t') comment 'hello world');
create table public.public.public (public int);
CREATE TABLE T ( Source string NOT NULL, Query_Id string NULL,	State string NOT NULL,Procedure_Name string);
create table if not exists t_not_exist_1 (v varchar(16777216));
create table t_not_exist_2 if not exists (v varchar(16777216));
create table if not exists t_not_exist_3 (i int) as select(v) from t1;
create table t_not_exist_4 if not exists (i int) as select(v) from t1;
CREATE OR REPLACE TABLE TESTSEED1 (IDENT int DEFAULT SEQID.NEXTVAL,mycol string);
CREATE OR REPLACE TABLE TESTSEED2 (IDENT int DEFAULT SCHEM.SEQID.NEXTVAL,mycol string);
CREATE OR REPLACE TABLE TESTSEED3 (ident int IDENTITY START 2);
CREATE OR REPLACE TABLE TESTSEED4 (ident int IDENTITY START WITH = 2);
CREATE OR REPLACE TABLE TESTSEED5 (ident int IDENTITY START = 2 INCREMENT BY 1);
CREATE OR REPLACE TABLE TESTSEED6 (ident int IDENTITY INCREMENT 2);
create table t_date_time_1 (v datetime(9));
CREATE TABLE T_DATE_TIME_2 (TIMESTAMP DATETIME,VALUE STRING,NAME STRING);

-- -- outline constraint
CREATE OR REPLACE TABLE T_OUT_1 (C1 STRING,UNIQUE(C1));
CREATE OR REPLACE TABLE T_OUT_2 (C2 STRING,PRIMARY KEY(C2));
CREATE OR REPLACE TABLE T_OUT_3 (C3 STRING,FOREIGN KEY(C3) REFERENCES T_OUT_2(C2));

CREATE OR REPLACE TABLE T_OUT_4 (C1 STRING,CONSTRAINT ANAME UNIQUE(C1));
CREATE OR REPLACE TABLE T_OUT_5 (C2 STRING,CONSTRAINT BNAME PRIMARY KEY(C2));
CREATE OR REPLACE TABLE T_OUT_6 (C3 STRING,CONSTRAINT CNAME FOREIGN KEY(C3) REFERENCES T_OUT_5(C2));

-- -- constraint properties
CREATE OR REPLACE TABLE T_CONSTRAINT_1 (C1 STRING,CONSTRAINT ANAME UNIQUE(C1) RELY ENFORCED VALIDATE );
CREATE OR REPLACE TABLE T_CONSTRAINT_2 (C1 STRING,CONSTRAINT ANAME UNIQUE(C1) INITIALLY IMMEDIATE NOT DEFERRABLE );
CREATE OR REPLACE TABLE T_CONSTRAINT_3 (C3 STRING,CONSTRAINT CNAME FOREIGN KEY(C3) REFERENCES T_OUT_5(C2) MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE);
CREATE OR REPLACE TABLE T_CONSTRAINT_4 (C3 STRING,CONSTRAINT CNAME FOREIGN KEY(C3) REFERENCES T_OUT_5(C2) MATCH PARTIAL ON UPDATE SET NULL ON DELETE RESTRICT );
CREATE OR REPLACE TABLE T_CONSTRAINT_5 (C3 STRING,CONSTRAINT CNAME FOREIGN KEY(C3) REFERENCES T_OUT_5(C2) ON UPDATE NO ACTION  );
CREATE OR REPLACE TABLE T_CONSTRAINT_6 (C3 STRING,CONSTRAINT CNAME FOREIGN KEY(C3) REFERENCES T_OUT_5(C2) DEFERRABLE );
CREATE OR REPLACE TABLE T_CONSTRAINT_7 (C1 STRING UNIQUE INITIALLY IMMEDIATE NOT DEFERRABLE );
CREATE OR REPLACE TABLE T_CONSTRAINT_8 (C3 STRING FOREIGN KEY REFERENCES T_OUT_5(C2) DEFERRABLE );
CREATE OR REPLACE TABLE T_CONSTRAINT_9 (C3 STRING CONSTRAINT INCNAME FOREIGN KEY REFERENCES T_OUT_5(C2) ON UPDATE NO ACTION  );
CREATE OR REPLACE TABLE T_CONSTRAINT_10 (C3 STRING FOREIGN KEY REFERENCES T_OUT_5 MATCH PARTIAL ON UPDATE SET NULL ON DELETE RESTRICT );
create table TestK (NVL2 string, FIRST_VALUE string, RESTRICT int, NVL int, RESPECT int);

Create table T_TAG_1(C1 string) WITH TAG ( TAG_NAME='T1');
create table t_cte
as
with q as (
    select 1 as c
)
select c from q;

create table tpk (i int primary key);
alter table tpk drop primary key;

create table tc1 comment = '' (i int);
create table tc2 (i int) comment = '';
create table tc3 (c char(4), c2 character(2));

create or replace table tz1(i TIMESTAMPLTZ);
create or replace table tz2(i TIMESTAMPNTZ);
create or replace table tz3(i TIMESTAMPTZ);
CREATE TABLE TESTSEED7 (ident int IDENTITY INCREMENT 2 ORDER);
CREATE TABLE TESTSEED8 (ident int IDENTITY START = 2 INCREMENT BY 1 NOORDER);
CREATE TABLE DIRECTION (LENGTH INT,LANGUAGE INT);

create table t_comment (i int) comment ='\'test\'';
create table T_NULL_NOT_NULL (C_NULL INT NULL NOT NULL); --Seems to not make sense but Snowflake accept it

create table if not exists t_cluster cluster by LINEAR(f1) (f1 varchar, f2 number) ;

-- virtual columns
create table t_virtual_1 (f1 number, f2 number, f3 number as (hash(f1,f2)));
create table t_virtual_2 (f1 number, f2 number, f3 number as (concat_ws(',',f1,f2)));
create table floor (any_value int,getdate int);
