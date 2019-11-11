CREATE TABLE `orders` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `created_at` datetime DEFAULT (now())
);

CREATE TABLE `order_items` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int DEFAULT null,
  `quantity` int DEFAULT 1
);

CREATE TABLE `products` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `price` decimal(10,4),
  `created_at` datetime DEFAULT (now())
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

ALTER TABLE `orders` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION ON DELETE RESTRICT;

ALTER TABLE `order_items` ADD FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `order_items` ADD FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;

ALTER TABLE `users` ADD FOREIGN KEY (`country_code`) REFERENCES `countries` (`code`) ON DELETE NO ACTION ON UPDATE NO ACTION;
