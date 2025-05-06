create table id_to_uuid_migration_map
(
column_name key_column_name_type not null,
int_key bigint not null,
uuid_key uuid,
constraint id_to_uuid_migration_pk
primary key (column_name, int_key),
constraint id_to_uuid_migration__uuid_uniq
unique (column_name, uuid_key)
)
partition by LIST (column_name);

alter table id_to_uuid_migration_map
owner to dw_admin;

create table id_to_uuid_migration_map__member_key
partition of id_to_uuid_migration_map
(
primary key (column_name, int_key),
unique (column_name, uuid_key),
constraint id_to_uuid_migration_map__c__member_key
check (column_name = 'member_key'::key_column_name_type)
)
FOR VALUES IN ('member_key');

alter table id_to_uuid_migration_map__member_key
owner to dw_admin;