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

ALTER TABLE IF EXISTS ONLY name*
    ADD COLUMN IF NOT EXISTS column_name data_type COLLATE collation,
    DROP COLUMN IF EXISTS column_name CASCADE,
    ALTER COLUMN column_name SET DATA TYPE data_type COLLATE collation USING expression,
    ALTER COLUMN column_name SET DEFAULT expression,
    ALTER COLUMN column_name DROP DEFAULT,
    ALTER COLUMN column_name SET NOT NULL,
    ALTER COLUMN column_name DROP NOT NULL,
    ALTER COLUMN column_name DROP EXPRESSION IF EXISTS,
    ALTER COLUMN column_name ADD GENERATED ALWAYS AS IDENTITY,
    ALTER COLUMN column_name SET GENERATED ALWAYS,
    ALTER COLUMN column_name DROP IDENTITY IF EXISTS,
    ALTER COLUMN column_name SET STATISTICS integer,
    ALTER COLUMN column_name SET ( attribute_option = value, attr2 = val2 ),
    ALTER COLUMN column_name RESET ( attribute_option, attr2, attr3),
    ALTER COLUMN column_name SET STORAGE MAIN,
    ALTER COLUMN column_name SET COMPRESSION compression_method,
    ALTER CONSTRAINT constraint_name,
    VALIDATE CONSTRAINT constraint_name,
    DROP CONSTRAINT IF EXISTS constraint_name CASCADE,
    DISABLE TRIGGER ALL,
    ENABLE TRIGGER ALL,
    ENABLE REPLICA TRIGGER trigger_name,
    ENABLE ALWAYS TRIGGER trigger_name,
    DISABLE RULE rewrite_rule_name,
    ENABLE RULE rewrite_rule_name,
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