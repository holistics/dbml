CREATE TABLE `orders` (
  `id` int PRIMARY KEY,
  `user_id` int UNIQUE NOT NULL,
  `status` varchar(255) COMMENT 'Status of an order',
  `created_at` varchar(255) COMMENT 'When order created'
);
