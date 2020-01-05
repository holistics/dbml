CREATE TABLE `users` (
  `id` int,
  `full_name` varchar(255),
  `email` varchar(255) UNIQUE,
  `gender` varchar(255),
  `date_of_birth` varchar(255),
  `created_at` varchar(255),
  `country_code` int,
  `active` boolean,
  PRIMARY KEY (`id`, `full_name`)
);

CREATE TABLE IF NOT EXISTS `products` 
(
  `id` int PRIMARY KEY DEFAULT 123,
  `name` varchar(255) DEFAULT 'Tea',
  `merchant_id` int NOT NULL,
  `price` float DEFAULT 123.12,
  `status` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT (now()),
  `stock` boolean DEFAULT true,
  `expiration` date DEFAULT (current_date + interval 1 year)
);

CREATE TABLE `cities` (
  `id` int,
  `code` varchar(255)
);

ALTER TABLE `cities` ADD PRIMARY KEY (`id`, `code`);

CREATE UNIQUE INDEX `users_index_0` ON `users` (`id`);

CREATE INDEX `User Name` ON `users` (`full_name`);

CREATE INDEX `users_index_2` ON `users` (`email`, `created_at`) USING HASH;

CREATE INDEX `users_index_3` ON `users` ((now()));

CREATE INDEX `users_index_4` ON `users` (`active`, ((lower(full_name))));

CREATE INDEX `users_index_5` ON `users` (((getdate()), (upper(gender))));

CREATE INDEX `users_index_6` ON `users` ((reverse(country_code)));