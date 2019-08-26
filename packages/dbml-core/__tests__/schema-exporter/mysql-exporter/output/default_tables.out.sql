CREATE TABLE `products` (
  `id` int PRIMARY KEY DEFAULT 123,
  `name` varchar(255) DEFAULT "Tea",
  `merchant_id` int NOT NULL,
  `price` float DEFAULT 123.12,
  `status` varchar(255) DEFAULT NULL,
  `created_at` varchar(255) DEFAULT (now()),
  `stock` boolean DEFAULT true,
  `expiration` date DEFAULT (current_date + interval 1 year)
);
