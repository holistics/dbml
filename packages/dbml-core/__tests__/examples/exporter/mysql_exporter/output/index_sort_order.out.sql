CREATE TABLE `orders` (
  `id` integer PRIMARY KEY,
  `customer_id` integer,
  `status` varchar(255),
  `created_at` timestamp
);

CREATE INDEX `orders_index_0` ON `orders` (`created_at` DESC);

CREATE INDEX `orders_customer_recent` ON `orders` (`customer_id`, `created_at` DESC);

CREATE UNIQUE INDEX `orders_index_2` ON `orders` (`status` DESC, `id`);

CREATE INDEX `orders_index_3` ON `orders` ((lower(status)) DESC);
