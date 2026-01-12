CREATE SCHEMA `schemaB`;

CREATE SCHEMA `ecommerce`;

CREATE SCHEMA `schemaA`;

CREATE TABLE `users` (
  `id` int PRIMARY KEY,
  `name` varchar(255),
  `pjs` ENUM ('created2', 'running2', 'done2', 'failure2'),
  `pjs2` ENUM ('created2', 'running2', 'done2', 'failure2'),
  `pg` ENUM ('male', 'female'),
  `pg2` ENUM ('male2', 'female2')
);

CREATE TABLE `products` (
  `id` int PRIMARY KEY,
  `name` varchar(255)
);

CREATE TABLE `ecommerce`.`users` (
  `id` int PRIMARY KEY,
  `name` varchar(255),
  `ejs` ENUM ('created2', 'running2', 'done2', 'failure2'),
  `ejs2` ENUM ('created2', 'running2', 'done2', 'failure2'),
  `eg` ENUM ('male', 'female'),
  `eg2` ENUM ('male2', 'female2')
);

CREATE TABLE `schemaA`.`products` (
  `id` int PRIMARY KEY,
  `name` varchar(255)
);

CREATE TABLE `schemaA`.`locations` (
  `id` int PRIMARY KEY,
  `name` varchar(255)
);

ALTER TABLE `products` COMMENT = 'This table contains products';

ALTER TABLE `schemaA`.`products` COMMENT = 'This table also contains products';

ALTER TABLE `schemaA`.`products` ADD FOREIGN KEY (`name`) REFERENCES `ecommerce`.`users` (`id`);

ALTER TABLE `schemaA`.`locations` ADD FOREIGN KEY (`name`) REFERENCES `users` (`id`);

ALTER TABLE `ecommerce`.`users` ADD FOREIGN KEY (`id`) REFERENCES `users` (`id`);

ALTER TABLE `ecommerce`.`users` ADD CONSTRAINT `name_optional` FOREIGN KEY (`id`) REFERENCES `users` (`name`);
