CREATE SCHEMA `users`;

CREATE TABLE `jobs` (
  `id` integer,
  `status` ENUM ('created', 'running', 'done'),
  `status_by_name` ENUM ('created', 'running', 'done')
);
