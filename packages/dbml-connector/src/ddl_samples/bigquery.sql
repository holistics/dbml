create schema if not exists dbml_test;

create table if not exists dbml_test.test_data_type_default (
    t_int INT64 default 1 OPTIONS(description="Int64 column"),
    t_bool_1 BOOLEAN default true,
    t_bool_2 BOOLEAN default True,
    t_string_1 STRING default 'string column description 1',
    t_string_2 STRING default "string column description 2",
    t_string_3 STRING default "NULL",
    t_float FLOAT64 default 123.67,
    t_decimal DECIMAL default 10,
    t_date DATE default CURRENT_DATE,
    t_datetime DATETIME default CURRENT_DATETIME,
    t_timestamp TIMESTAMP default CURRENT_TIMESTAMP,
    t_array ARRAY<INT64> default ARRAY<INT64>[1, 2, 3],
    t_struct STRUCT<
        street STRING,
        city STRING,
        zip_code INT64
    > default STRUCT('123 Example St', 'Sample City', 12345),
    t_interval INTERVAL,
    t_geo GEOGRAPHY
) OPTIONS(description="Table description");

create table if not exists dbml_test.test_constraint_1 (
    id int64,
    primary key (id) not enforced
);

create table if not exists dbml_test.test_constraint_2 (
    id int64,
    name string,

    primary key (id, name) not enforced
);

create table if not exists dbml_test.test_constraint_3 (
    id int64,
    fk_id int64
);
alter table dbml_test.test_constraint_3
add foreign key (fk_id) references dbml_test.test_constraint_1 (id) not enforced;

create table if not exists dbml_test.test_constraint_4 (
    fk_id int64,
    fk_name string,
    primary key (fk_id, fk_name) not enforced
);
alter table dbml_test.test_constraint_4
add foreign key (fk_id, fk_name) references dbml_test.test_constraint_2 (id, name) not enforced;

create table dbml_test.test_all_index (
  a string,
  b int64,
  c struct <d int64, e array<string>, f struct<g string, h int64>>
);

create search index all_col_index
on dbml_test.test_all_index(ALL COLUMNS)
options (analyzer = 'NO_OP_ANALYZER');

create table dbml_test.test_multi_index (a string, b int64, c json, d timestamp);

create search index multi_index
on dbml_test.test_multi_index (a, b, c)
options ( data_types = ['string', 'int64', 'timestamp']);

create table dbml_test.test_index (a string, b int64);

create search index simple_index
on dbml_test.test_index (a);
