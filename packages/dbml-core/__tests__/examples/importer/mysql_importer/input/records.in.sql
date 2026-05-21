CREATE TABLE `users` (
  `id` integer PRIMARY KEY,
  `name` varchar(255),
  `email` varchar(255)
);

-- First INSERT statement
INSERT INTO `users` (`id`, `name`, `email`)
VALUES
  (1, 'Alice', 'alice@example.com'),
  (2, 'Bob', 'bob@example.com');

-- Second INSERT statement for the same table
INSERT INTO `users` (`id`, `name`, `email`)
VALUES
  (3, 'Charlie', 'charlie@example.com');

-- Third INSERT statement with different column order
INSERT INTO `users` (`email`, `id`, `name`)
VALUES
  ('dave@example.com', 4, 'Dave');

CREATE TABLE `posts` (
  `id` integer PRIMARY KEY,
  `user_id` integer,
  `title` varchar(255)
);

-- Multiple INSERT statements for posts table
INSERT INTO `posts` (`id`, `user_id`, `title`)
VALUES
  (1, 1, 'First Post');

INSERT INTO `posts` (`id`, `user_id`, `title`)
VALUES
  (2, 1, 'Second Post'),
  (3, 2, 'Bob Post');
