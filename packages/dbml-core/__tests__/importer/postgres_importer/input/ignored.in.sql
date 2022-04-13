ALTER INDEX name RENAME TO new_name;
ALTER SCHEMA name RENAME TO new_name;


ALTER TABLE IF EXISTS ONLY name*
    RENAME COLUMN column_name TO new_column_name;
ALTER TABLE IF EXISTS name
    RENAME column_name TO new_column_name;
ALTER TABLE name
    RENAME CONSTRAINT constraint_name TO new_constraint_name;
ALTER TABLE name
    RENAME TO new_name;

ALTER TABLE IF EXISTS name
    SET SCHEMA new_schema;

ALTER TABLE ALL IN TABLESPACE name OWNED BY role_name
    SET TABLESPACE new_tablespace NOWAIT;
ALTER TABLE ALL IN TABLESPACE name
    SET TABLESPACE new_tablespace;
ALTER TABLE ALL IN TABLESPACE name OWNED BY role_name1, role_name2,role_name3,   role_name4
    SET TABLESPACE new_tablespace;

ALTER TABLE IF EXISTS name
    ATTACH PARTITION partition_name FOR VALUES partition_bound_spec;
ALTER TABLE name
    ATTACH PARTITION partition_name DEFAULT;

ALTER TABLE IF EXISTS name
    DETACH PARTITION partition_name CONCURRENTLY;
ALTER TABLE name
    DETACH PARTITION partition_name FINALIZE;

ALTER COLUMN column_name SET DEFAULT abc;