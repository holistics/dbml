CREATE TABLE `users` (
  `id` integer PRIMARY KEY,
  `name` varchar(255),
  `email` varchar(255),
  `active` boolean,
  `created_at` timestamp
);

CREATE TABLE `posts` (
  `id` integer PRIMARY KEY,
  `user_id` integer,
  `title` varchar(255),
  `content` text
);

ALTER TABLE `posts` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

-- Disable foreign key checks for INSERT
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO `users` (`id`, `name`, `email`, `active`, `created_at`)
VALUES
  (1, 'Alice', 'alice@example.com', TRUE, '2024-01-15 10:30:00+07:00'),
  (2, 'Bob', 'bob@example.com', FALSE, '2024-01-16 14:20:00+07:00'),
  (3, 'Charlie', NULL, TRUE, '2024-01-17 09:15:00+07:00');
INSERT INTO `posts` (`id`, `user_id`, `title`, `content`)
VALUES
  (1, 1, 'First Post', 'Hello World'),
  (2, 1, 'Second Post', 'It''s a beautiful day');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;