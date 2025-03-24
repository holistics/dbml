-- SET
SET search_path TO my_schema, public;

SET TIME ZONE 'Europe/Rome';

SET SESSION AUTHORIZATION 'paul';

RESET SESSION AUTHORIZATION;

SET TRANSACTION SNAPSHOT '00000003-0000001B-1';

-- SELECT
SELECT * FROM name;

SELECT * FROM distributors ORDER BY name;

SELECT m.name AS mname, pname
	FROM manufacturers m LEFT JOIN LATERAL get_product_names(m.id) pname ON true;

-- DROP
DROP OPERATOR CLASS widget_ops USING btree;

DROP DATABASE name;

-- USE


-- CREATE SEQUENCE
CREATE SEQUENCE serial START 101;

-- CREATE SCHEMA
CREATE SCHEMA IF NOT EXISTS test AUTHORIZATION joe;

CREATE SCHEMA hollywood
    CREATE TABLE films (title text, release date, awards text[])
    CREATE VIEW winners AS
        SELECT title, release FROM films WHERE awards IS NOT NULL;