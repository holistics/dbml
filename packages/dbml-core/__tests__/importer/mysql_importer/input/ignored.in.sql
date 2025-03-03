/* 
    ALTER TABLE ...
    https://dev.mysql.com/doc/refman/8.0/en/alter-table.html
*/
ALTER TABLE t1 ENGINE = InnoDB;
ALTER TABLE t1 ROW_FORMAT = COMPRESSED;
ALTER TABLE t1 AUTO_INCREMENT = 13;
ALTER TABLE t1 CHARACTER SET = utf8;
ALTER TABLE t1 COMMENT = 'New table comment';
ALTER TABLE t1 MODIFY b INT NOT NULL;
ALTER TABLE t1 RENAME COLUMN a TO b,
               RENAME COLUMN b TO a;
-- "rotate" a, b, c through a cycle
ALTER TABLE t1 RENAME COLUMN a TO b,
               RENAME COLUMN b TO c,
               RENAME COLUMN c TO a;
ALTER TABLE tbl_name DROP FOREIGN KEY fk_symbol;
ALTER TABLE tbl_name CONVERT TO CHARACTER SET utf8;

/* other ALTER syntax */
ALTER DATABASE mydb READ ONLY = 0 DEFAULT COLLATE utf8mb4_bin;

ALTER EVENT myevent
    -- this is a comment; 
    ON SCHEDULE
      EVERY 12 HOUR
    STARTS CURRENT_TIMESTAMP + INTERVAL 4 HOUR;
ALTER EVENT myevent
    DISABLE;

ALTER FUNCTION func_name COMMENT  /*
; 'string'
;*/ 'string';

ALTER INSTANCE ROTATE INNODB MASTER KEY;

ALTER LOGFILE GROUP lg_3
    ADD UNDOFILE 'undo_10.dat'
    INITIAL_SIZE=32M
    ENGINE=NDBCLUSTER;

ALTER PROCEDURE proc_name COMMENT 'string';

ALTER SERVER s OPTIONS (USER 'sally');