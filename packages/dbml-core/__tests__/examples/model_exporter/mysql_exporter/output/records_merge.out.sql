CREATE TABLE `users` (
  `id` integer PRIMARY KEY,
  `name` varchar(255),
  `email` varchar(255)
);

CREATE TABLE `posts` (
  `id` integer PRIMARY KEY,
  `user_id` integer,
  `title` varchar(255)
);

-- Disable foreign key checks for INSERT
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO `users` (`id`, `name`, `email`)
VALUES
  (1, 'Alice', 'alice@example.com'),
  (2, 'Bob', 'bob@example.com');
INSERT INTO `users` (`id`, `name`, `email`)
VALUES
  (3, 'Charlie', 'charlie@example.com');
INSERT INTO `users` (`email`, `id`, `name`)
VALUES
  ('dave@example.com', 4, 'Dave');
INSERT INTO `posts` (`id`, `user_id`, `title`)
VALUES
  (1, 1, 'First Post');
INSERT INTO `posts` (`id`, `user_id`, `title`)
VALUES
  (2, 1, 'Second Post'),
  (3, 2, 'Bob Post');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
