CREATE TABLE `users`
(
  `id` int PRIMARY KEY,
  `full_name` varchar(255),
  `email` varchar(255) UNIQUE,
  `gender` varchar(255),
  `date_of_birth` varchar(255),
  `created_at` varchar(255),
  `country_code` int,
  `active` boolean NOT NULL
);

CREATE UNIQUE INDEX  `index_name`ON `users`(`id`);

CREATE  INDEX `User Name` ON `users`(`full_name`);

CREATE  INDEX  `index_name1` ON `users`(`email`,`created_at`) USING HASH;

CREATE  INDEX  `index_name2` ON `users`(now());

CREATE  INDEX  `index_name3` ON `users`(`active`, lower(full_name));

CREATE  INDEX  `index_name4` ON `users`(getdate(), upper(gender));

CREATE  INDEX  `index_name5` ON `users`(reverse(country_code));