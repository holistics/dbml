CREATE TABLE database_products (
    product_id NUMBER(10) PRIMARY KEY,
    product_name VARCHAR2(100) NOT NULL,
    vendor_name VARCHAR2(100),
    release_year NUMBER(4),
    is_open_source NUMBER(1) DEFAULT 0,
    license_cost NUMBER(10, 2),
    market_share NUMBER(5, 2),
    latest_version VARCHAR2(20),
    description CLOB,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    is_active NUMBER(1) DEFAULT 1,
    max_connections NUMBER(10),
    status CHAR(1) DEFAULT 'A'
);

-- 1. Basic INSERT with all columns specified
INSERT INTO database_products (
    product_id, product_name, vendor_name, release_year, is_open_source, 
    license_cost, market_share, latest_version, description, is_active, max_connections, status
) VALUES (
    db_products_seq.NEXTVAL, 'Oracle Database', 'Oracle Corporation', 1979, 0, 
    47500.00, 28.5, '21c', 'Enterprise relational database management system', 1, 10000, 'A'
);

-- 2. INSERT with boolean-like values (0/1)
INSERT INTO database_products (product_name, vendor_name, is_open_source, is_active)
VALUES ('MySQL', 'Oracle Corporation', 1, 1);

-- 3. INSERT with NULL values explicitly
INSERT INTO database_products (product_name, vendor_name, license_cost, description)
VALUES ('PostgreSQL', 'PostgreSQL Global Development Group', NULL, NULL);

-- 4. INSERT with numeric expressions
INSERT INTO database_products (product_name, release_year, market_share, max_connections)
VALUES ('SQLite', 2000, 15.5 + 2.3, 1000 * 10);

-- 5. INSERT with string functions
INSERT INTO database_products (product_name, vendor_name, description, latest_version)
VALUES (
    UPPER('microsoft sql server'),
    'Microsoft' || ' Corporation',  -- Oracle uses || for concatenation
    TRIM('  Relational database management system  '),
    SUBSTR('2022-CU10', 1, 4)  -- Oracle uses SUBSTR not SUBSTRING
);

-- 6. INSERT with date/time functions
INSERT INTO database_products (product_name, vendor_name, release_year, created_at)
VALUES ('MariaDB', 'MariaDB Foundation', EXTRACT(YEAR FROM SYSDATE), SYSTIMESTAMP);

-- 7. INSERT multiple rows using INSERT ALL
INSERT ALL
    INTO database_products (product_name, vendor_name, is_open_source, market_share) 
        VALUES ('MongoDB', 'MongoDB Inc.', 1, 8.2)
    INTO database_products (product_name, vendor_name, is_open_source, market_share) 
        VALUES ('Redis', 'Redis Ltd.', 1, 6.7)
    INTO database_products (product_name, vendor_name, is_open_source, market_share) 
        VALUES ('Cassandra', 'Apache Software Foundation', 1, 4.1)
SELECT * FROM DUAL;

-- 8. INSERT with mathematical calculations
INSERT INTO database_products (product_name, license_cost, market_share, max_connections)
VALUES ('IBM Db2', 1500.00 * 12, ROUND(5.678, 1), POWER(2, 14));

-- 9. INSERT with conditional expression (CASE)
INSERT INTO database_products (product_name, vendor_name, license_cost, is_open_source)
VALUES (
    'Amazon Aurora',
    'Amazon Web Services',
    CASE WHEN 1=1 THEN 0.00 ELSE 1000.00 END,
    0
);

-- 10. INSERT with only some columns (others will use defaults)
INSERT INTO database_products (product_name) 
VALUES ('CockroachDB');

-- 11. INSERT with negative numbers
INSERT INTO database_products (product_name, license_cost, release_year)
VALUES ('Test Database', -100.00, 2020);

-- 12. INSERT with very large numbers
INSERT INTO database_products (product_name, max_connections, license_cost)
VALUES ('Enterprise DB', 999999, 99999.99);

-- 13. INSERT with string containing newlines using CHR(10)
INSERT INTO database_products (product_name, description)
VALUES ('Neo4j', 'Graph database for connected data' || CHR(10) || 'Supports Cypher query language');

-- 14. INSERT with TO_DATE function
INSERT INTO database_products (product_name, release_year, created_at)
VALUES ('Firebird', 2000, TO_TIMESTAMP('2000-07-25 10:30:00', 'YYYY-MM-DD HH24:MI:SS'));

-- 15. INSERT with column order different from table definition
INSERT INTO database_products (is_active, product_name, is_open_source, vendor_name)
VALUES (1, 'TimescaleDB', 1, 'Timescale Inc.');

-- 16. INSERT with zero values
INSERT INTO database_products (product_name, license_cost, market_share, max_connections)
VALUES ('MemSQL', 0.00, 0.0, 0);

-- 17. INSERT using SYSDATE and string concatenation
INSERT INTO database_products (product_name, release_year, latest_version, created_at)
VALUES ('InfluxDB', EXTRACT(YEAR FROM SYSDATE), 'v' || '2.7', SYSDATE);

-- 18. INSERT with NVL function (null value handling)
INSERT INTO database_products (product_name, vendor_name, license_cost)
VALUES ('Vertica', 'Micro Focus', NVL(NULL, 5000.00));

-- 19. INSERT with DECODE function
INSERT INTO database_products (product_name, is_open_source, status)
VALUES ('Greenplum', DECODE('yes', 'yes', 1, 'no', 0, 0), 'A');

-- 20. INSERT with LENGTH function
INSERT INTO database_products (product_name, max_connections, vendor_name)
VALUES ('SAP HANA', LENGTH('Maximum'), 'SAP SE');

-- 21. INSERT with INITCAP (capitalize first letter)
INSERT INTO database_products (product_name, vendor_name)
VALUES (INITCAP('clickhouse'), INITCAP('clickhouse inc'));

-- 22. INSERT with COALESCE function
INSERT INTO database_products (product_name, license_cost, market_share)
VALUES ('Snowflake', COALESCE(NULL, NULL, 2500.00), 3.5);

-- 23. INSERT with GREATEST/LEAST functions
INSERT INTO database_products (product_name, max_connections, market_share)
VALUES ('Teradata', GREATEST(1000, 5000, 3000), LEAST(10.5, 8.2, 15.7));

-- 24. INSERT with MOD function
INSERT INTO database_products (product_name, max_connections, release_year)
VALUES ('Informix', MOD(10050, 1000), 1980 + MOD(45, 20));

-- 25. INSERT using sequence explicitly
INSERT INTO database_products (product_id, product_name, vendor_name)
VALUES (db_products_seq.NEXTVAL, 'DynamoDB', 'Amazon Web Services');

-- 26. INSERT with LPAD/RPAD functions
INSERT INTO database_products (product_name, latest_version)
VALUES ('SingleStore', LPAD('8', 3, '0') || '.' || RPAD('5', 2, '0'));

-- 27. INSERT with REPLACE function
INSERT INTO database_products (product_name, description)
VALUES ('Azure SQL', REPLACE('Microsoft cloud database service', 'cloud', 'managed cloud'));

-- 28. INSERT with ABS (absolute value)
INSERT INTO database_products (product_name, license_cost, market_share)
VALUES ('Db2 Warehouse', ABS(-15000), ABS(-4.5));

-- 29. INSERT with TRUNC function
INSERT INTO database_products (product_name, market_share, license_cost)
VALUES ('Actian Ingres', TRUNC(7.89456, 2), TRUNC(12345.6789, 2));

-- 30. INSERT with multiple function combinations
INSERT INTO database_products (product_name, vendor_name, latest_version, release_year)
VALUES (
    UPPER(SUBSTR('rockset database', 1, 7)),
    INITCAP(TRIM('  rockset inc  ')),
    'v' || TO_CHAR(ROUND(2.75, 1)),
    TO_NUMBER(TO_CHAR(SYSDATE, 'YYYY')) - 5
);
