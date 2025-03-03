#begin
-- Intersections
-- -- Binary: charset and datatype
select _binary 'hello' as c1;
create table t1(col1 binary(20));
create table t2(col varchar(10) binary character set cp1251);
create table t3(col varchar(10) binary character set binary);
#end
#begin
-- -- Keywords, which can be ID. Intersect that keywords and ID
#end
#begin
-- Expression test
select +-!1 as c;
select 0 in (20 = any (select col1 from t1)) is not null is not unknown as t;
select 0 in (20 = any (select col1 from t1)) is not unknown as t;
select 20 = any (select col1 from t1) is not unknown as t;
select 20 = any (select col1 from t1) as t;
-- select sqrt(20.5) not in (sqrt(20.5) not in (select col1 from t1), 1 in (1, 2, 3, 4)) as c;
select 20 in (10 in (5 in (1, 2, 3, 4, 5), 1, 1, 8), 8, 8, 8);
select (1 in (2, 3, 4)) in (0, 1, 2) as c;
select 1 and (5 between 1 and 10) as c;

select 1 = 16/4 between 3 and 5 as c;
select 1 = 16/4 between 5 and 6 as c;
#end
#begin
-- Functions test
select *, sqrt(a), lower(substring(str, 'a', length(str)/2)) as col3 from tab1 where a is not \N;
#end
#begin
-- Spatial data type tests
INSERT INTO geom VALUES (GeomFromWKB(0x0101000000000000000000F03F000000000000F03F));
select y(point(1.25, 3.47)) as y, x(point(1.25, 3.47)) as x;
#end

#begin
OPTIMIZE TABLE t1;
OPTIMIZE TABLE t1, t2;
OPTIMIZE TABLES t1;
OPTIMIZE TABLES t1, t2;
optimize local table t1;
#end

#begin
KILL CONNECTION 12345;
KILL QUERY 12345;
KILL CONNECTION @conn_variable;
KILL QUERY @query_variable;
KILL CONNECTION @@global_variable;
KILL QUERY @@global_variable;
#end
#begin
create procedure f (a1 int)
begin
	kill query a1;
end;
#end
#begin
-- Mysql spec comment
select 1 /*!, ' hello' */, 2 /*! union select 5, ' world', 10 */;
select * from t /*! where col = somefunc(col2) order by sortcol */; insert into mytable /*!(col2, col3, col1) */ values (load_file('sompath'), 'str1', 2);
insert into tbl values ('a', 1, 'b'), ('c', 2, 'd'), ('e', 3, 'f') /*! on duplicate key update notsecret_col = secret_col */;
select clientname, email from users where clientname='Petrov'/*! UNION SELECT 1,load_file('/etc/passwd')*/;#
#end
#begin
-- Duplicate query with ordinal comment
select 1 /*, ' hello' */, 2 /*! union select 5, ' world', 10 */;
select * from t /* where col = somefunc(col2) order by sortcol */; insert into mytable /*(col2, col3, col1) */ values (load_file('sompath'), 'str1', 2);
insert into tbl values ('a', 1, 'b'), ('c', 2, 'd'), ('e', 3, 'f') /* on duplicate key update notsecret_col = secret_col */;
select clientname, email from users where clientname='Petrov'/* UNION SELECT 1,load_file('/etc/passwd')*/;#
#end

#begin
-- Empty line comment
--
--
#end

GRANT ALL ON *.* TO `foo2` @`%`;
GRANT ALL ON *.* TO `foo2` @test;
GRANT ALL ON tbl TO admin@localhost;
GRANT ALL ON tbl TO admin;
GRANT ALL PRIVILEGES ON tbl TO admin;
GRANT ALL ON *.* TO admin;
GRANT ALL ON *.* TO `admin`;
GRANT ALL ON *.* TO 'admin';
GRANT ALL ON *.* TO "admin";
GRANT ALL ON db.* TO "admin";
GRANT ALL on db.tbl to 'admin';
GRANT ALL on `db`.`tbl` to 'admin';
GRANT ALL on `db`.tbl to 'admin';
GRANT ALL on db.`tbl` to 'admin';
GRANT SESSION_VARIABLES_ADMIN on *.* to 'u2';
GRANT 'SESSION_VARIABLES_ADMIN' on *.* to 'u2';
GRANT `SESSION_VARIABLES_ADMIN` on *.* to 'u2';
GRANT "SESSION_VARIABLES_ADMIN" on *.* to 'u2';
GRANT BACKUP_ADMIN ON *.* TO `admin`@`%`;
GRANT CREATE ROLE, DROP ROLE ON *.* TO `admin`@`localhost`;
GRANT AUDIT_ADMIN, BACKUP_ADMIN, BINLOG_ADMIN, BINLOG_ENCRYPTION_ADMIN, CLONE_ADMIN, CONNECTION_ADMIN,
ENCRYPTION_KEY_ADMIN, FIREWALL_ADMIN, FIREWALL_USER, GROUP_REPLICATION_ADMIN, INNODB_REDO_LOG_ARCHIVE,
NDB_STORED_USER, PERSIST_RO_VARIABLES_ADMIN, REPLICATION_APPLIER, REPLICATION_SLAVE_ADMIN, RESOURCE_GROUP_ADMIN,
RESOURCE_GROUP_USER, ROLE_ADMIN, SESSION_VARIABLES_ADMIN, SET_USER_ID, SHOW_ROUTINE, SYSTEM_VARIABLES_ADMIN, AUTHENTICATION_POLICY_ADMIN,
TABLE_ENCRYPTION_ADMIN, VERSION_TOKEN_ADMIN, XA_RECOVER_ADMIN, AUDIT_ABORT_EXEMPT, FIREWALL_EXEMPT, SKIP_QUERY_REWRITE, TP_CONNECTION_ADMIN ON *.* TO `admin`@`localhost`;
GRANT SELECT, INSERT, UPDATE ON *.* TO u4 AS u1 WITH ROLE r1;
GRANT SELECT, RELOAD, REPLICATION SLAVE, REPLICATION CLIENT, SHOW VIEW, EVENT, TRIGGER ON *.* TO 'xuser1'@'%', 'xuser2'@'%'
AS 'root'@'%' WITH ROLE 'cloudsqlsuperuser'@'%';
GRANT ALTER ON *.* TO 'admin'@'localhost'
GRANT ALTER ROUTINE ON *.* TO 'admin'@'localhost'
GRANT CREATE ON *.* TO 'admin'@'localhost'
GRANT CREATE TEMPORARY TABLES ON *.* TO 'admin'@'localhost'
GRANT CREATE ROUTINE ON *.* TO 'admin'@'localhost'
GRANT CREATE VIEW ON *.* TO 'admin'@'localhost'
GRANT CREATE USER ON *.* TO 'admin'@'localhost'
GRANT CREATE TABLESPACE ON *.* TO 'admin'@'localhost'
GRANT CREATE ROLE ON *.* TO 'admin'@'localhost'
GRANT DELETE ON *.* TO 'admin'@'localhost'
GRANT DROP ON *.* TO 'admin'@'localhost'
GRANT DROP ROLE ON *.* TO 'admin'@'localhost'
GRANT EVENT ON *.* TO 'admin'@'localhost'
GRANT EXECUTE ON *.* TO 'admin'@'localhost'
GRANT FILE ON *.* TO 'admin'@'localhost'
GRANT GRANT OPTION ON *.* TO 'admin'@'localhost'
GRANT INDEX ON *.* TO 'admin'@'localhost'
GRANT INSERT ON *.* TO 'admin'@'localhost'
GRANT LOCK TABLES ON *.* TO 'admin'@'localhost'
GRANT PROCESS ON *.* TO 'admin'@'localhost'
GRANT PROXY ON *.* TO 'admin'@'localhost'
GRANT REFERENCES ON *.* TO 'admin'@'localhost'
GRANT RELOAD ON *.* TO 'admin'@'localhost'
GRANT REPLICATION CLIENT ON *.* TO 'admin'@'localhost'
GRANT REPLICATION SLAVE ON *.* TO 'admin'@'localhost'
GRANT SELECT ON *.* TO 'admin'@'localhost'
GRANT SHOW VIEW ON *.* TO 'admin'@'localhost'
GRANT SHOW DATABASES ON *.* TO 'admin'@'localhost'
GRANT SHUTDOWN ON *.* TO 'admin'@'localhost'
GRANT SUPER ON *.* TO 'admin'@'localhost'
GRANT TRIGGER ON *.* TO 'admin'@'localhost'
GRANT UPDATE ON *.* TO 'admin'@'localhost'
GRANT USAGE ON *.* TO 'admin'@'localhost'
GRANT APPLICATION_PASSWORD_ADMIN ON *.* TO 'admin'@'localhost'
GRANT AUDIT_ADMIN ON *.* TO 'admin'@'localhost'
GRANT BACKUP_ADMIN ON *.* TO 'admin'@'localhost'
GRANT BINLOG_ADMIN ON *.* TO 'admin'@'localhost'
GRANT BINLOG_ENCRYPTION_ADMIN ON *.* TO 'admin'@'localhost'
GRANT CLONE_ADMIN ON *.* TO 'admin'@'localhost'
GRANT CONNECTION_ADMIN ON *.* TO 'admin'@'localhost'
GRANT ENCRYPTION_KEY_ADMIN ON *.* TO 'admin'@'localhost'
GRANT FIREWALL_ADMIN ON *.* TO 'admin'@'localhost'
GRANT FIREWALL_USER ON *.* TO 'admin'@'localhost'
GRANT FLUSH_OPTIMIZER_COSTS ON *.* TO 'admin'@'localhost'
GRANT FLUSH_STATUS ON *.* TO 'admin'@'localhost'
GRANT FLUSH_TABLES ON *.* TO 'admin'@'localhost'
GRANT FLUSH_USER_RESOURCES ON *.* TO 'admin'@'localhost'
GRANT GROUP_REPLICATION_ADMIN ON *.* TO 'admin'@'localhost'
GRANT INNODB_REDO_LOG_ARCHIVE ON *.* TO 'admin'@'localhost'
GRANT INNODB_REDO_LOG_ENABLE ON *.* TO 'admin'@'localhost'
GRANT NDB_STORED_USER ON *.* TO 'admin'@'localhost'
GRANT PERSIST_RO_VARIABLES_ADMIN ON *.* TO 'admin'@'localhost'
GRANT REPLICATION_APPLIER ON *.* TO 'admin'@'localhost'
GRANT REPLICATION_SLAVE_ADMIN ON *.* TO 'admin'@'localhost'
GRANT RESOURCE_GROUP_ADMIN ON *.* TO 'admin'@'localhost'
GRANT RESOURCE_GROUP_USER ON *.* TO 'admin'@'localhost'
GRANT ROLE_ADMIN ON *.* TO 'admin'@'localhost'
GRANT SERVICE_CONNECTION_ADMIN ON *.* TO 'admin'@'localhost'
GRANT SESSION_VARIABLES_ADMIN ON *.* TO 'admin'@'localhost'
GRANT SET_USER_ID ON *.* TO 'admin'@'localhost'
GRANT SHOW_ROUTINE ON *.* TO 'admin'@'localhost'
GRANT SYSTEM_USER ON *.* TO 'admin'@'localhost'
GRANT SYSTEM_VARIABLES_ADMIN ON *.* TO 'admin'@'localhost'
GRANT TABLE_ENCRYPTION_ADMIN ON *.* TO 'admin'@'localhost'
GRANT VERSION_TOKEN_ADMIN ON *.* TO 'admin'@'localhost'
GRANT XA_RECOVER_ADMIN ON *.* TO 'admin'@'localhost'
GRANT reader TO 'mysqluser'@'localhost'
GRANT reader TO topreader
GRANT reader TO topreader WITH ADMIN OPTION;
GRANT 'db_old_ro'@'%' TO 'oghalawinji'@'%'
GRANT FLUSH_OPTIMIZER_COSTS, FLUSH_STATUS, FLUSH_TABLES, FLUSH_USER_RESOURCES, PASSWORDLESS_USER_ADMIN ON *.* TO "@"
REVOKE reader FROM 'mysqluser'@'localhost'
REVOKE reader FROM topreader
REVOKE `cloudsqlsuperuser`@`%` FROM `sarmonitoring`@`10.90.29.%`
-- Set Role
SET ROLE DEFAULT;
SET ROLE 'role1', 'role2';
SET ROLE ALL;
SET ROLE ALL EXCEPT 'role1', 'role2';
-- Set Default Role
SET DEFAULT ROLE 'admin', 'developer' TO 'joe'@'10.0.0.1';
SET DEFAULT ROLE `admin`@'%' to `dt_user`@`%`;
-- MySQL on Amazon RDS
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, RELOAD, PROCESS, REFERENCES, INDEX, ALTER, SHOW DATABASES, CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, REPLICATION SLAVE, REPLICATION CLIENT, CREATE VIEW, SHOW VIEW, CREATE ROUTINE, ALTER ROUTINE, CREATE USER, EVENT, TRIGGER, LOAD FROM S3, SELECT INTO S3, INVOKE LAMBDA ON *.* TO 'debezium_user'@'127.0.0.1';

#begin
ANALYZE TABLE t1;
ANALYZE TABLE t2, t3;
ANALYZE TABLES t2, t3;
ANALYZE TABLE t1 UPDATE HISTOGRAM ON c1, c2;
ANALYZE TABLE t2 UPDATE HISTOGRAM ON c1 WITH 2 BUCKETS;
ANALYZE TABLE t2 DROP HISTOGRAM ON c1;
#end

#begin
flush hosts, status;
#end

#begin
-- Table flushing
flush tables;
flush local tables Foo;
flush tables Foo, Bar;
flush tables Foo, Bar for export;
flush tables Foo, Bar with read lock;
#end
#begin
-- 'FLUSH TABLE' is an alias for 'FLUSH TABLES' (https://dev.mysql.com/doc/refman/8.0/en/flush.html)
flush table;
flush local table Foo;
flush TABLE Foo, Bar;
flush table Foo, Bar for export;
#end

#begin
-- delete one-table syntax
delete from t1 where col1 = true and (col2 - col3 <= (select count(*) from t2) or maincol/2 > 100.2);
delete low_priority from mytable where value_col > 0 order by sort_col desc limit 10;
delete quick ignore from test.parenttable where id*2 + somecol < 10;
#end
#begin
-- delete multiple-table syntax
delete ignore t1.*, alias_t2 from t1 inner join t3 on t1.col1 = t3.somecol and t1.col2 > t3.col_for_compare left join t2 as alias_t2 on t1.col1 <= alias_t2.col1 and alias_t2.col_onecol + t3.col_for_compare <> t1.sum_col
where alias_t2.not_null_col is not null and t1.primary_key_column >= 100;
-- http://dev.mysql.com/doc/refman/5.6/en/delete.html
DELETE FROM t1, t2 USING t1 INNER JOIN t2 INNER JOIN t3 WHERE t1.id=t2.id AND t2.id=t3.id;
DELETE t1, t2 FROM t1 INNER JOIN t2 INNER JOIN t3 WHERE t1.id=t2.id AND t2.id=t3.id;
DELETE t1 FROM t1 LEFT JOIN t2 ON t1.id=t2.id WHERE t2.id IS NULL;
DELETE a1, a2 FROM t1 AS a1 INNER JOIN t2 AS a2 WHERE a1.id=a2.id;
DELETE FROM a1, a2 USING t1 AS a1 INNER JOIN t2 AS a2 WHERE a1.id=a2.id;
#end
#begin
-- delete with table alias
DELETE FROM t1 alias_t1 WHERE alias_t1.col1 > 0;
DELETE FROM t1 as alias_t1 WHERE alias_t1.col1 > 0;
#end

#begin
-- insert on select
insert into t1 select * from t2;
insert into some_ship_info
select ship_power.gun_power, ship_info.*
FROM
	(
		select s.name as ship_name, sum(g.power) as gun_power, max(callibr) as max_callibr
		from
			ships s inner join ships_guns sg on s.id = sg.ship_id inner join guns g on g.id = sg.guns_id
		group by s.name
	) ship_power
	inner join
	(
		select s.name as ship_name, sc.class_name, sc.tonange, sc.max_length, sc.start_build, sc.max_guns_size
		from
			ships s inner join ship_class sc on s.class_id = sc.id
	) ship_info using (ship_name);
	
INSERT INTO l4stal13prema00.`fusion` ( `partition en` , `classe` , `segment` , `F tot` , `F loc` , `indice specif` ) 
SELECT * FROM f3p1 WHERE 1;
#end
#begin
-- insert base syntax
insert ignore into t1(col1, col2, col3) values ('abc', 0, .12), ('adfasdf',23432, -.12);
INSERT INTO test_auto_inc () VALUES ();
-- http://dev.mysql.com/doc/refman/5.6/en/insert.html
INSERT INTO tbl_name (col1,col2) VALUES(col2*2, 15);
INSERT INTO tbl_name (col1,col2) VALUES(15,col1*2);
INSERT INTO logs (`site_id`, `time`,`hits`) VALUES (1,"2004-08-09", 15) ON DUPLICATE KEY UPDATE hits=hits+15;
INSERT INTO t2 (b, c)
	VALUES ((SELECT a FROM t1 WHERE b='Chip'), 'shoulder'),
	((SELECT a FROM t1 WHERE b='Chip'), 'old block'),
	((SELECT a FROM t1 WHERE b='John'), 'toilet'),
	((SELECT a FROM t1 WHERE b='John'), 'long,silver'),
	((SELECT a FROM t1 WHERE b='John'), 'li''l');
INSERT INTO tbl_test (FirstName)
SELECT 'Aleem' UNION ALL SELECT 'Latif' UNION ALL SELECT 'Mughal';

#end
#begin
-- not latin1 literals
insert into t values ('кириллица', 2, 3);
insert INTO `wptests_posts` (`post_author`, `post_date`, `post_date_gmt`, `post_content`, `post_content_filtered`, `post_title`, `post_excerpt`, `post_status`, `post_type`, `comment_status`, `ping_status`, `post_password`, `post_name`, `to_ping`, `pinged`, `post_modified`, `post_modified_gmt`, `post_parent`, `menu_order`, `post_mime_type`, `guid`) VALUES (7, '2016-09-06 16:49:51', '2016-09-06 16:49:51', '', '', 'صورة', '', 'inherit', 'attachment', 'open', 'closed', '', '%d8%b5%d9%88%d8%b1%d8%a9', '', '', '2016-09-06 16:49:51', '2016-09-06 16:49:51', 0, 0, 'image/jpeg', '');
#end
insert into sql_log values(retGUID,log_type,log_text,0,0,current_user,now());
insert into sql_log values(retGUID,log_type,log_text,0,0,current_user(),now());

#begin
INSERT INTO t1 (a,b,c) VALUES (1,2,3),(4,5,6) AS new ON DUPLICATE KEY UPDATE c = new.a+new.b; 
#end

#begin
replace into t1 values (default, 1, '2', abs(-10 * col1) + sqrt(col2/col3));
replace table1(col1, col2, col3) value (1, 2, 3), (4, 5, 6), (7, 8, 9);
replace into t2(str1, str2) values (null, 'abc'), ('some' ' string' ' to replace', @someval);
replace into new_t select * from old_t;
#end
#begin
-- http://dev.mysql.com/doc/refman/5.6/en/replace.html
REPLACE INTO test VALUES (1, 'Old', '2014-08-20 18:47:00');
REPLACE INTO test VALUES (1, 'New', '2014-08-20 18:47:42');
REPLACE INTO T SELECT * FROM T;
REPLACE LOW_PRIORITY INTO `online_users` SET `session_id`='3580cc4e61117c0785372c426eddd11c', `user_id` = 'XXX', `page` = '/', `lastview` = NOW();
#end

###https://dev.mysql.com/doc/refman/8.0/en/table.html
#begin
TABLE t;
#end

#begin
TABLE t LIMIT 3;
#end

#begin
TABLE t ORDER BY b LIMIT 3;
#end

select 5--1;

#begin
select 1 union select 2;
#end

#begin
select 1 as a1, 10 as a2 union all select 2, 20 union distinct select 3, 30 union distinct select 2, 20 union all select 3, 30;

#end

#begin
(select 1 as a1, 10 as a2) union all (select 2, 20);
#end

#begin
(select 1 as a1, 10 as a2) union all (select 2, 20) union distinct (select 3, 30);
#end

#begin
select 1 as a1, 10 as a2 union all select 2, 20 union distinct (select 3, 30);
#end

#begin
select 1 as a1, 10 as a2 union all (select 2, 20) union distinct (select 3, 30);
#end

#begin
select 1 as a1, 10 as a2 union all (select 2, 20) union distinct select 3, 30;
#end

#begin
select 1 as a1, 10 as a2 union all (select 2, 20) union distinct (select 3, 30) union distinct select 2, 20 union all select 3, 30;
#end

#begin
select 1 as a1, 10 as a2 union all (select 2, 20) union distinct select 3, 30 union distinct select 2, 20 union all select 3, 30;
select 1 as a1, 10 as a2 union all (select 2, 20) union distinct select 3, 30 union distinct (select 2, 20) union all select 3, 30;
#end

#begin
((select 1 as a1, 10 as a2)) union all (((select 2, 20))) union distinct (select 3, 30);
#end

#begin
((select 1 as a1, 10 as a2)) union all (((select 2, 20))) union distinct (select 3, 30 into outfile 'test.dump');
#end

#begin
select 1 as a1, 10 as a2 union all (select 2, 20) union distinct (select 3, 30) union distinct select 2, 20 union all select 3, 30 into outfile 'test.dump';
#end

#begin
select 1 as a1, 10 as a2 union all (select 2, 20) union distinct select 3, 30 order by 1;
select 1 as a1, 10 as a2 union all (select 2, 20 order by 2) union distinct select 3, 30 order by 1;
select 1 as a1, 10 as a2 union all (select 2, 20 order by 2) union distinct (select 3, 30 order by 1);
select 1 as a1, 10 as a2 union all (select 2, 20 order by 2) union distinct (select 3, 30 order by 1) order by 2;
#end

#begin
-- update one-table syntax
update t set col = 100 where id = 101;
update ignore t1 set `column_name` = default, `one-more-column` = (to_seconds(now()) mod 33);
#end
#begin
-- update multiple-table syntax
update t1, t2, t3 inner join t4 using (col_name1, col_name2)
set t1.value_col = t3.new_value_col, t4.`some-col*` = `t2`.`***` * 2
where  t1.pk = t2.fk_t1_pk and t2.id = t4.fk_id_entity;
#end
#begin
-- http://dev.mysql.com/doc/refman/5.6/en/update.html
UPDATE t1 SET col1 = col1 + 1;
UPDATE t1 SET col1 = col1 + 1, col2 = col1;
UPDATE t SET id = id + 1 ORDER BY id DESC;
UPDATE items,month SET items.price=month.price WHERE items.id=month.id;
UPDATE `Table A`,`Table B` SET `Table A`.`text`=concat_ws('',`Table A`.`text`,`Table B`.`B-num`," from ",`Table B`.`date`,'/')
WHERE `Table A`.`A-num` = `Table B`.`A-num`;
UPDATE TABLE_1 LEFT JOIN TABLE_2 ON TABLE_1.COLUMN_1= TABLE_2.COLUMN_2 SET TABLE_1.`COLUMN` = EXPR WHERE TABLE_2.COLUMN2 IS NULL;
UPDATE Groups LEFT JOIN (SELECT GroupId, MIN(ValWithinGroup) AS baseVal FROM Groups GROUP BY GroupId) AS GrpSum USING (GroupId) SET ValWithinGroup=ValWithinGroup-baseVal;
update Table1 t1 join Table2 t2 on t1.ID=t2.t1ID join Table3 t3 on t2.ID=t3.t2ID set t1.Value=12345 where t3.ID=54321;
#end

#begin
-- Recursive CTE
WITH RECURSIVE cte (n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM cte WHERE n < 10
)
SELECT n FROM cte;

WITH RECURSIVE cte AS (
  SELECT id, name, manager_id
  FROM employees
  WHERE id = 1 
  UNION ALL
  SELECT e.id, e.name, e.manager_id
  FROM employees e
  JOIN cte ON e.manager_id = cte.id
)
SELECT * FROM cte;

WITH RECURSIVE cte AS (
  SELECT id, name, parent_id
  FROM departments
  WHERE id = 1
  UNION ALL
  SELECT d.id, d.name, d.parent_id
  FROM departments d
  JOIN cte ON d.parent_id = cte.id
)
SELECT * FROM cte;
#end
#begin
--Non-recursive Ctes
WITH cte1 AS (
  SELECT * FROM table1 WHERE col1 = 'value'
),
cte2 AS (
  SELECT * FROM table2 WHERE col2 = 'value'
)
SELECT cte1.col1, cte2.col2 FROM cte1 JOIN cte2 ON cte1.id = cte2.id;
#end

#begin
select 1+2*3-4;
select 1+9/3-2;
select 2+9%2-1；
#end