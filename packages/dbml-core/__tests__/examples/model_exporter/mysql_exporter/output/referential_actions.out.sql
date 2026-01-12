CREATE TABLE `orders` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` int UNIQUE NOT NULL,
  `status` orders_status_enum,
  `created_at` varchar(255)
);

CREATE TABLE `order_items` (
  `order_id` int,
  `product_id` int,
  `product_name` varchar(255),
  `quantity` int DEFAULT 1
);

CREATE TABLE `products` (
  `id` int,
  `name` varchar(255),
  `price` decimal(10,4),
  `created_at` datetime DEFAULT (now()),
  PRIMARY KEY (`id`, `name`)
);

CREATE TABLE `users` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `email` varchar(255) UNIQUE,
  `date_of_birth` datetime,
  `created_at` datetime DEFAULT (now()),
  `country_code` int NOT NULL
);

CREATE TABLE `countries` (
  `code` int PRIMARY KEY,
  `name` varchar(255),
  `continent_name` varchar(255)
);

ALTER TABLE `orders` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

ALTER TABLE `order_items` ADD FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

ALTER TABLE `order_items` ADD FOREIGN KEY (`product_id`, `product_name`) REFERENCES `products` (`id`, `name`) ON DELETE SET NULL;

ALTER TABLE `users` ADD FOREIGN KEY (`country_code`) REFERENCES `countries` (`code`) ON DELETE NO ACTION;
