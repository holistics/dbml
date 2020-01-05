CREATE TABLE `jobs`
(
  `id` integer PRIMARY KEY,
  `status` ENUM ('created', 'running', 'done', 'failed', 'wait for validation')
);

CREATE TABLE IF NOT EXISTS `orders`
(
  `id` int PRIMARY KEY,
  `created_at` varchar(255),
  `priority` ENUM ('low', 'medium', 'high'),
  `status` ENUM('pending', 'processing', 'done')
);