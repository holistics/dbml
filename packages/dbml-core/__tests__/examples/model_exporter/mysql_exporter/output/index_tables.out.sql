CREATE TABLE `users` (
  `id` int,
  `full_name` varchar(255),
  `email` varchar(255) UNIQUE,
  `gender` varchar(255),
  `date_of_birth` varchar(255),
  `created_at` varchar(255),
  `country_code` int,
  `active` boolean,
  PRIMARY KEY (`id`, `full_name`)
);

CREATE UNIQUE INDEX `users_index_0` ON `users` (`id`);

CREATE INDEX `User Name` ON `users` (`full_name`);

CREATE INDEX `users_index_2` ON `users` (`email`, `created_at`) USING HASH;

CREATE INDEX `users_index_3` ON `users` ((now()));

CREATE INDEX `users_index_4` ON `users` (`active`, ((lower(full_name))));

CREATE INDEX `users_index_5` ON `users` (((getdate()), (upper(gender))));

CREATE INDEX `users_index_6` ON `users` ((reverse(country_code)));
