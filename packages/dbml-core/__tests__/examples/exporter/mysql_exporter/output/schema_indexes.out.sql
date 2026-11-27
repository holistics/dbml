CREATE SCHEMA `schemaA`;

CREATE TABLE `schemaA`.`products` (
  `id` int PRIMARY KEY,
  `name` varchar(255),
  `merchant_id` int
);

CREATE INDEX `product_merchant_index` ON `schemaA`.`products` (`merchant_id`);

CREATE UNIQUE INDEX `products_index_1` ON `schemaA`.`products` (`name`);
