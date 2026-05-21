CREATE TABLE IF NOT EXISTS `products` 
(
  `id` int PRIMARY KEY DEFAULT 123 COMMENT 'just a comment',
  `name` varchar(255) DEFAULT 'Tea' COMMENT 'name length <= 255',
  `merchant_id` int NOT NULL
);