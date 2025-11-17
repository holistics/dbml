-- SQL dump generated using DBML (dbml-lang.org)
-- Database: MySQL
-- Generated at: 2019-08-26T11:00:50.221Z

CREATE TABLE `country` (
  `id` int PRIMARY KEY,
  `country` varchar(255),
  `last_update` timestamp
);

CREATE TABLE `city` (
  `id` int PRIMARY KEY,
  `city` varchar(255),
  `country_id` int,
  `last_update` timestamp
);

CREATE TABLE `address` (
  `id` int PRIMARY KEY,
  `address` varchar(255),
  `address2` varchar(255),
  `district` varchar(255),
  `city_id` int,
  `postal_code` varchar(255),
  `phone` varchar(255),
  `last_update` timestamp
);

CREATE TABLE `customer` (
  `id` int PRIMARY KEY,
  `store_id` int,
  `first_name` varchar(255),
  `last_name` varchar(255),
  `email` varchar(255),
  `address_id` int,
  `active` boolean,
  `create_Date` timestamp,
  `last_update` timestamp
);

ALTER TABLE `city` ADD FOREIGN KEY (`country_id`) REFERENCES `country` (`id`);

ALTER TABLE `address` ADD FOREIGN KEY (`city_id`) REFERENCES `city` (`id`);

ALTER TABLE `customer` ADD FOREIGN KEY (`address_id`) REFERENCES `address` (`id`);

CREATE INDEX `customer_index_0` ON `customer` (`id`, `first_name`) USING BTREE;
