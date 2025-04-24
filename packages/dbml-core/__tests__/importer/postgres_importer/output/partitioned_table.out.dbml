Table "id_to_uuid_migration_map" {
  "column_name" key_column_name_type [not null]
  "int_key" bigint [not null]
  "uuid_key" uuid

  Indexes {
    (column_name, int_key) [pk, name: "id_to_uuid_migration_pk"]
    (column_name, uuid_key) [unique, name: "id_to_uuid_migration__uuid_uniq"]
  }
}
