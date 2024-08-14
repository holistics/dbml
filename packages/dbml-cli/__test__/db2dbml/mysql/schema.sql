-- create table
create table users (
  user_id int unsigned auto_increment primary key,
  username varchar(50) unique not null,
  email varchar(100) unique not null,
  password_hash varchar(255) not null,
  first_name varchar(50),
  last_name varchar(50),
  date_of_birth date,
  created_at timestamp default current_timestamp,
  last_login timestamp default now(),
  is_active tinyint(1) default 1
);

create table products (
  id int unsigned primary key auto_increment,
  price decimal(10,2) not null,
  quantity int not null,
  total_value decimal(10,2) generated always as ((price * quantity)) stored,
  updated_at timestamp default current_timestamp on update current_timestamp
);

create table orders (
  order_id int unsigned auto_increment primary key,
  user_id int unsigned
);

create table order_items (
  order_id int unsigned not null,
  product_id int unsigned not null
);

alter table order_items
add constraint fk_detail_items_orders
foreign key (order_id) references orders (order_id) on delete cascade;

alter table order_items
add constraint fk_detail_items_products
foreign key (product_id) references products (id) on delete no action;

alter table orders
add constraint fk_order_user
foreign key (user_id) references users (user_id) on delete set null;

create table if not exists categories (
	cat_id int unsigned auto_increment,
  cat_name varchar(50) not null,
  super_cat_id int unsigned,
  created_at timestamp default current_timestamp,

  constraint pk_category primary key (cat_id),
  fulltext fulltext_index_category (cat_name)
);

create table default_example (
  id int auto_increment primary key,
  column1 varchar(255) default (concat('default ', uuid())),
  column2 varchar(255) default (concat('random ', floor(rand() * 100))),
  column3 varchar(255) default '_utf8mb4',
  column4 double default 0.5,
  created_date date default (current_date),
  first_date date default '2023-01-01',
  event_time timestamp default '2024-01-01 00:00:00'
);

create table sqrt_triangle (
  side_a double default null,
  side_b double default null,
  side_c double generated always as (sqrt(((side_a * side_a) + (side_b * side_b)))) virtual
);

-- composite foreign key, primary key, unique
create table composite_key_1 (
  id1_1 int unsigned,
  id1_2 int unsigned,

  email varchar(255),
  name varchar(50),
  primary key (id1_1, id1_2)
);

alter table composite_key_1
add constraint uc_unique_composite unique (email, name);

create table composite_key_2 (
  id2_1 int unsigned,
  id2_2 int unsigned,

  primary key (id2_1, id2_2)
);

alter table composite_key_1
add constraint fk_test_composite foreign key (id1_1, id1_2)
references composite_key_2 (id2_1, id2_2);

-- enum
create table status_example_2 (
  s1 enum('active', 'inactive', 'pending') not null,
  s2 enum('active', 'inactive', 'pending') default null,
  s3 enum('active', 'inactive', 'pending') default 'active',
  s4 enum('active', 'inactive', 'pending') default 'pending',
  s5 enum('0', '1', '2'),
  s6 enum('0', '1', '2') not null,
  s7 enum('0', '1', '2') default '1',
  s8 enum('0', '1', '2') default '0'
);

-- full index type
create table index_example (
  id int auto_increment primary key,
  name_lower varchar(100) not null,
  name_inline varchar(100) not null,
  email varchar(100) not null,
  age int,
  city varchar(50),
  index idx_name (name_inline)
);

create index idx_name_lower on index_example ((lower(name_lower)));
create index idx_city_age on index_example (city, age);
create index idx_city_part on index_example (city(5));
create unique index idx_email_unique on index_example (email);

-- comments & hash index
create table hash_index_example (
  id int primary key comment 'unique identifier for each record',
  name varchar(100) comment 'first name of the individual',
  name1 varchar(100) comment 'last name of the individual',
  index idx_name_name1 (name, name1) using hash comment 'hash index for fast lookups on name and name1'
) engine=memory comment='table for storing names with a hash index';

create table date_time_example (
  default_now timestamp default localtime(),
  default_local timestamp default now(),
  date_plus_7_days date default (current_date() + interval 7 day),
  date_minus_30_days date default (current_date - interval 30 day),
  timestamp_plus_1_hour timestamp default (current_timestamp + interval 1 hour),
  timestamp_minus_15_minutes timestamp default (current_timestamp - INTERVAL 15 minute),
  on_update_1 datetime default now() on update now(),
  on_update_2 datetime default now() on update localtime()
);
