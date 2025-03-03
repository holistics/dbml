-- https://github.com/holistics/dbml/issues/482
CREATE TABLE `pulse_aggregates` (
  `bucket` int(10) unsigned NOT NULL,
  `period` mediumint(8) unsigned NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_hash` binary(16) GENERATED ALWAYS AS (unhex(md5(`key`))) VIRTUAL,
  `aggregate` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` decimal(20,2) NOT NULL,
  `count` int(10) unsigned DEFAULT NULL,
  UNIQUE KEY `pulse_aggregates_bucket_period_type_aggregate_key_hash_unique` (`bucket`,`period`,`type`,`aggregate`,`key_hash`),
  KEY `pulse_aggregates_period_bucket_index` (`period`,`bucket`),
  KEY `pulse_aggregates_type_index` (`type`),
  KEY `pulse_aggregates_period_type_aggregate_bucket_index` (`period`,`type`,`aggregate`,`bucket`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- https://github.com/holistics/dbml/issues/465
start transaction;

create table `users` (
    `id` serial primary key,
    `email` varchar(255) not null unique,
    `first_name` varchar(255) not null,
    `last_name` varchar(255) not null,
    `active` boolean not null,
    `root` boolean not null default false,
    index `idx_users_email` (`email`)
) ENGINE=InnoDB default CHARSET=utf8mb4; -- noqa:LT01

create table `user_roles` (
    `id` serial primary key,
    `role_name` varchar(255) not null unique,
    `description` varchar(255) default null
) ENGINE=InnoDB default CHARSET=utf8mb4; -- noqa:LT01

create table `user_role_links` (
    `user_id` bigint unsigned not null,
    `role_id` bigint unsigned not null,
    primary key (`user_id`, `role_id`),

    constraint `user_role_links_fk_1` foreign key (`user_id`) references `users` (`id`),
    constraint `user_role_links_fk_2` foreign key (`role_id`) references `user_roles` (`id`)
) ENGINE=InnoDB default CHARSET=utf8mb4; -- noqa:LT01

commit;

-- https://github.com/holistics/dbml/issues/304
-- https://github.com/holistics/dbml/issues/303
create table table1 (
    id int primary key,
    name varchar(255) not null unique,
    FULLTEXT KEY (`name`)
);

-- https://github.com/holistics/dbml/issues/216
create table a (
    id varchar(22) binary
);

-- https://github.com/holistics/dbml/issues/120
CREATE TABLE `example` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=InnoDB COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;