/* ALTER TABLE: https://www.postgresql.org/docs/current/sql-altertable.html */
ALTER TABLE IF EXISTS ONLY name.*
    RENAME COLUMN column_name TO new_column_name;
ALTER TABLE IF EXISTS name
    RENAME column_name TO new_column_name;
ALTER TABLE name
    RENAME CONSTRAINT constraint_name TO new_constraint_name;
ALTER TABLE name
    RENAME TO new_name;

ALTER TABLE IF EXISTS name
    SET SCHEMA /* comment goes here; */ new_schema;

ALTER TABLE ALL IN TABLESPACE name OWNED BY role_name
    SET TABLESPACE new_tablespace NOWAIT;
ALTER TABLE ALL IN TABLESPACE name
    SET TABLESPACE new_tablespace;
ALTER TABLE ALL IN TABLESPACE name OWNED BY role_name1, role_name2,role_name3,   role_name4
    SET TABLESPACE new_tablespace;

ALTER TABLE IF EXISTS name
    ATTACH PARTITION partition_name FOR VALUES IN (1);
ALTER TABLE name
    ATTACH PARTITION partition_name DEFAULT;

ALTER TABLE IF EXISTS name
    DETACH PARTITION /* comment goes here; */ partition_name;
ALTER TABLE name
    DETACH PARTITION partition_name;

ALTER TABLE IF EXISTS ONLY name.*
    ADD COLUMN IF NOT EXISTS column_name data_type COLLATE collation_name,
    DROP COLUMN IF EXISTS column_name CASCADE,
    ALTER COLUMN column_name SET DATA TYPE data_type COLLATE collation_name USING expression,
    ALTER COLUMN column_name SET DEFAULT expression,
    ALTER COLUMN column_name DROP DEFAULT,
    ALTER COLUMN column_name SET NOT NULL,
    ALTER COLUMN column_name DROP NOT NULL,
    ALTER COLUMN column_name DROP EXPRESSION IF EXISTS,
    ALTER COLUMN column_name ADD GENERATED ALWAYS AS IDENTITY,
    ALTER COLUMN column_name SET GENERATED ALWAYS,
    ALTER COLUMN column_name DROP IDENTITY IF EXISTS,
    ALTER COLUMN column_name SET STATISTICS 1,
    ALTER COLUMN column_name SET ( attribute_option = value, attr2 = val2 ),
    ALTER COLUMN column_name RESET ( attribute_option, attr2, attr3),
    ALTER COLUMN column_name SET STORAGE MAIN,
    ALTER CONSTRAINT constraint_name,
    VALIDATE CONSTRAINT constraint_name,
    DROP CONSTRAINT IF EXISTS constraint_name CASCADE,
    DISABLE TRIGGER ALL,
    ENABLE TRIGGER ALL,
    ENABLE REPLICA TRIGGER trigger_name,
    ENABLE ALWAYS TRIGGER trigger_name,
    DISABLE RULE rewrite_rule_name,
    ENABLE RULE rewrite_rule_name,
    /* comment goes here; */
    ENABLE REPLICA RULE rewrite_rule_name,
    ENABLE ALWAYS RULE rewrite_rule_name,
    DISABLE ROW LEVEL SECURITY,
    ENABLE ROW LEVEL SECURITY,
    FORCE ROW LEVEL SECURITY,
    NO FORCE ROW LEVEL SECURITY,
    CLUSTER ON index_name,
    SET WITHOUT CLUSTER,
    SET WITHOUT OIDS,
    SET TABLESPACE new_tablespace,
    SET LOGGED,
    SET (storage_parameter = value),
    RESET (storage_parameter),
    INHERIT parent_table,
    NO INHERIT parent_table,
    OF type_name,
    NOT OF,
    OWNER TO CURRENT_USER,
    REPLICA IDENTITY DEFAULT
;

/* Other ALTER syntax: https://www.postgresql.org/docs/current/sql-commands.html */
ALTER AGGREGATE myavg(integer) RENAME TO my_average;
ALTER AGGREGATE myavg(integer) OWNER TO joe;

ALTER COLLATION "de_DE" RENAME /* ; */TO 
    -- ;;;
    german;

ALTER CONVERSION /* random comment; */ iso_8859_1_to_utf8 RENAME TO latin1_to_unicode;

ALTER DEFAULT PRIVILEGES IN SCHEMA myschema GRANT SELECT ON TABLES TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA myschema GRANT INSERT ON TABLES TO webuser;

ALTER DOMAIN zipcode SET NOT NULL;

ALTER EVENT TRIGGER name DISABLE;

ALTER EXTENSION hstore UPDATE TO '2.0';

ALTER FOREIGN DATA WRAPPER dbi OPTIONS (ADD foo '1', DROP 'bar');

ALTER FOREIGN TABLE myschema.distributors OPTIONS (ADD opt1 'value', SET opt2 'value2', DROP 'value3');

ALTER FUNCTION sqrt(integer) OWNER TO joe;

ALTER GROUP staff ADD USER karl, john;
ALTER GROUP workers DROP USER beth;

ALTER INDEX distributors RENAME TO suppliers;
ALTER INDEX distributors SET TABLESPACE fasttablespace;

ALTER MATERIALIZED VIEW foo RENAME TO bar;

ALTER OPERATOR && (_int4, _int4) SET (RESTRICT = _int_contsel, JOIN = _int_contjoinsel);

ALTER OPERATOR FAMILY integer_ops USING btree ADD
  -- int4 vs int2
  OPERATOR 1 < (int4, int2) ,
  OPERATOR 2 <= (int4, int2) ,
  OPERATOR 3 = (int4, int2) ,
  OPERATOR 4 >= (int4, int2) ,
  OPERATOR 5 > (int4, int2) ,
  FUNCTION 1 btint42cmp(int4, int2) ,
  -- int2 vs int4
  OPERATOR 1 < (int2, int4) ,
  OPERATOR 2 <= (int2, int4) ,
  OPERATOR 3 = (int2, int4) ,
  OPERATOR 4 >= (int2, int4) ,
  OPERATOR 5 > (int2, int4) ,
  FUNCTION 1 btint24cmp(int2, int4) ;

ALTER OPERATOR FAMILY integer_ops USING btree ADD
  -- int4 vs int2
  OPERATOR 1 < (int4, int2) ,
  OPERATOR 2 <= (int4, int2) ,
  OPERATOR 3 = (int4, int2) ,
  OPERATOR 4 >= (int4, int2) ,
  OPERATOR 5 > (int4, int2) ,
  FUNCTION 1 btint42cmp(int4, int2) ,
  -- int2 vs int4
  OPERATOR 1 < (int2, int4) ,
  OPERATOR 2 <= (int2, int4) ,
  OPERATOR 3 = (int2, int4) ,
  OPERATOR 4 >= (int2, int4) ,
  OPERATOR 5 > (int2, int4) ,
  FUNCTION 1 btint24cmp(int2, int4) ;

ALTER POLICY name ON table_name RENAME TO new_name;

ALTER PROCEDURE insert_data(integer, integer) RENAME TO insert_record;

ALTER PUBLICATION noinsert SET (publish = 'update, delete');

ALTER ROLE chris VALID UNTIL 'May 4 12:00:00 2015 +1';

ALTER ROUTINE foo(integer) RENAME TO foobar;

ALTER RULE notify_all ON emp RENAME TO notify_me;

ALTER SCHEMA name RENAME TO new_name;

ALTER SEQUENCE serial RESTART WITH 105;

ALTER SERVER foo VERSION '8.4' OPTIONS (SET host 'baz');

ALTER SUBSCRIPTION mysub SET PUBLICATION insert_only;

ALTER SYSTEM SET wal_level = replica;

ALTER TABLESPACE index_space RENAME TO fast_raid;

ALTER TEXT SEARCH CONFIGURATION my_config
  ALTER MAPPING REPLACE english WITH swedish;

ALTER TEXT SEARCH DICTIONARY my_dict ( StopWords = newrussian );

ALTER TEXT SEARCH PARSER name RENAME TO new_name;
ALTER TEXT SEARCH PARSER name SET SCHEMA new_schema;

ALTER TEXT SEARCH TEMPLATE name RENAME TO new_name;
ALTER TEXT SEARCH TEMPLATE name SET SCHEMA new_schema;

ALTER TRIGGER emp_stamp ON emp RENAME TO emp_track_chgs;

ALTER TYPE electronic_mail RENAME TO email;

ALTER USER name RENAME TO new_name;

ALTER USER MAPPING FOR bob SERVER foo OPTIONS (SET password 'public');

ALTER VIEW foo RENAME TO bar;

ALTER TABLE organization_units OWNER TO "user";
ALTER TABLE table_name ADD COLUMN valid BOOLEAN;

-- https://github.com/holistics/dbml/issues/345
CREATE MATERIALIZED VIEW country_total_debt_2
as
  select country_name,
  sum(debt) as total_debt
  from international_debt
  group by country_name order by country_name
WITH NO DATA;
