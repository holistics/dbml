CREATE TABLE `orders` (
  `id` int,
  `customer_id` int,
  `status` varchar(20),
  `created_at` timestamp,
  PRIMARY KEY (`id` DESC),
  INDEX `orders_customer_recent` (`customer_id`, `created_at` DESC)
);

CREATE INDEX `orders_created` ON `orders` (`created_at` DESC);
CREATE UNIQUE INDEX `orders_status_id` ON `orders` (`status` DESC, `id` ASC);
CREATE INDEX `orders_lower_status` ON `orders` ((lower(status)) DESC);
