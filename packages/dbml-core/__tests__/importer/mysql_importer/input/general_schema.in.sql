CREATE TABLE `orders` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` int UNIQUE NOT NULL,
  `status` ENUM ('created', 'running', 'done', 'failure'),
  `created_at` varchar(255)
);

CREATE TABLE `order_items` (
  `order_id` int,
  `product_id` int,
  `quantity` int DEFAULT 1
);

CREATE TABLE `products` (
  `id` int,
  `name` varchar(255),
  `merchant_id` int NOT NULL,
  `price` int,
  `status` ENUM ('Out of Stock', 'In Stock'),
  `created_at` datetime DEFAULT (now()),
  PRIMARY KEY (`id`, `price`)
) COMMENT = 'Notes about products table';

CREATE TABLE `users` (
  `id` int PRIMARY KEY,
  `full_name` varchar(255),
  `email` varchar(255) UNIQUE,
  `gender` varchar(255),
  `date_of_birth` varchar(255),
  `created_at` varchar(255),
  `country_code` int
) COMMENT = 'User basic information';

CREATE TABLE `merchants` (
  `id` int PRIMARY KEY,
  `merchant_name` varchar(255),
  `country_code` int,
  `created_at` varchar(255),
  `admin_id` int
);

CREATE TABLE `countries` (
  `code` int PRIMARY KEY,
  `name` varchar(255),
  `continent_name` varchar(255)
);

CREATE TABLE `composite_service_item` (
  `composite_service_item_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `ticket_item_id` int(11) NOT NULL,
  `discount` decimal(10,0) NOT NULL,
  `original_price` decimal(10,0) NOT NULL,
  `patient_price` decimal(10,0) NOT NULL,
  `insurance_price` decimal(10,0) NOT NULL,
  PRIMARY KEY  (`composite_service_item_id`),
  KEY `ticket_item_id` (`ticket_item_id`),
  KEY `service_id` (`service_id`),
  KEY `service_id, ticket_item_id` USING HASH (`service_id`,`ticket_item_id`),
  KEY `composite_service_item_id` USING BTREE    (`composite_service_item_id`),
  KEY `test test test key` USING HASH(`service_id`,`patient_price`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `Countries` (
  `Id` int NOT NULL,
  `Name` varchar(32) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `States` (
  `Id` int NOT NULL,
  `CountryId` int NOT NULL,
  `Name` varchar(32) NOT NULL,
  PRIMARY KEY (`Id`,`CountryId`),
  KEY `IX_States_CountryId` (`CountryId`),
  CONSTRAINT `FK_States_Countries_CountryId` FOREIGN KEY (`CountryId`) REFERENCES `Countries` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Cities` (
  `Id` int NOT NULL,
  `CountryId` int NOT NULL,
  `StateId` int NOT NULL,
  `Name` varchar(32) NOT NULL,
  PRIMARY KEY (`Id`,`StateId`,`CountryId`),
  KEY `IX_Cities_CountryId` (`CountryId`),
  KEY `IX_Cities_StateId_CountryId` (`StateId`,`CountryId`),
  CONSTRAINT `FK_Cities_Countries_CountryId` FOREIGN KEY (`CountryId`) REFERENCES `Countries` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Cities_States_StateId_CountryId` FOREIGN KEY (`StateId`, `CountryId`) REFERENCES `States` (`Id`, `CountryId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `order_items` ADD FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);

ALTER TABLE `order_items` ADD FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

ALTER TABLE `users` ADD FOREIGN KEY (`country_code`) REFERENCES `countries` (`code`);

ALTER TABLE `merchants` ADD FOREIGN KEY (`country_code`) REFERENCES `countries` (`code`);

ALTER TABLE `products` ADD FOREIGN KEY (`merchant_id`) REFERENCES `merchants` (`id`);

ALTER TABLE `merchants` ADD FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`);

CREATE INDEX `product_status` ON `products` (`merchant_id`, `status`);

CREATE UNIQUE INDEX `products_index_1` ON `products` (`id`) USING HASH;
