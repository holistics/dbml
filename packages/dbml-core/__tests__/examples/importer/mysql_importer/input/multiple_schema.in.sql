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
  `name` varchar(255) COMMENT 'Product name'
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
  `name` varchar(255) COMMENT 'Sample field comment on multiples schema',
  `lid` int,
  CONSTRAINT `FK_1` FOREIGN KEY (`lid`) REFERENCES `schemaA`.`locations` (`id`) ON DELETE CASCADE
);

CREATE TABLE `schemaA`.`locations` (
  `id` int PRIMARY KEY,
  `name` varchar(255)
);

CREATE TABLE `orders` (
  `id1` int,
  `id2` int,
  `pid` int REFERENCES `schemaA`.`products`(id),
  `name` varchar(255),
  `name2` varchar(255),
  CONSTRAINT `CPK_1` PRIMARY KEY testtest USING HASH (`id1`, id2),
  CONSTRAINT `I_UNIQUE_1` UNIQUE KEY testtest2 USING BTREE (name, `name2`),
  KEY `INDEX_2` USING HASH (id1, id2)
) COMMENT "this is table orders";

CREATE TABLE `orders2` (
  `id1` int,
  `id2` int,
  `pid` int REFERENCES `schemaA`.`products`(id),
  CONSTRAINT PRIMARY KEY testCPK (`id1`, id2),
  CONSTRAINT `CFK_1` FOREIGN KEY (`id1`, id2) REFERENCES orders (id1, `id2`) ON UPDATE SET NULL ON DELETE CASCADE
);

CREATE TABLE schemaB.`orders3` (
  id1 int,
  id2 int
);

ALTER TABLE `schemaB`.orders3 ADD PRIMARY KEY (id1);

CREATE TABLE `orders4` (
  id1 int,
  `id2` int
);

ALTER TABLE orders4 ADD CONSTRAINT `PK_orders4_id1_id2` PRIMARY KEY (id1, id2);

ALTER TABLE `ecommerce`.`users` ADD FOREIGN KEY (`id`) REFERENCES `users` (`id`);

ALTER TABLE `ecommerce`.`users` ADD CONSTRAINT `name_optional` FOREIGN KEY (`id`) REFERENCES `users` (`name`);

ALTER TABLE `schemaA`.`products` ADD FOREIGN KEY (`name`) REFERENCES `ecommerce`.`users` (`id`);

ALTER TABLE `schemaA`.`locations` ADD FOREIGN KEY (`name`) REFERENCES `users` (`id`);
