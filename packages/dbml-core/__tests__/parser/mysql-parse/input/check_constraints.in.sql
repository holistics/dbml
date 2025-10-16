-- Column-level CHECK constraints
CREATE TABLE `products` (
  `id` int PRIMARY KEY,
  `price` decimal(10,4) CHECK (`price` > 0),
  `quantity` int CHECK (`quantity` >= 0),
  `discount` decimal(5,2) CHECK (`discount` >= 0 AND `discount` <= 100),
  `status` varchar(20) CHECK (`status` IN ('active', 'inactive', 'pending'))
);

-- Table-level CHECK constraints
CREATE TABLE `orders` (
  `order_id` int PRIMARY KEY,
  `order_date` datetime,
  `delivery_date` datetime,
  `total` decimal(10,2),
  CHECK (`delivery_date` > `order_date`),
  CHECK (`total` >= 0)
);

-- Named CHECK constraints
CREATE TABLE `employees` (
  `emp_id` int PRIMARY KEY,
  `age` int,
  `salary` decimal(10,2),
  `email` varchar(100),
  CONSTRAINT chk_age CHECK (`age` >= 18 AND `age` <= 65),
  CONSTRAINT chk_salary CHECK (`salary` > 0)
);

-- Multiple CHECK constraints on same column
CREATE TABLE `inventory` (
  `item_id` int PRIMARY KEY,
  `stock` int CHECK (`stock` >= 0) CHECK (`stock` <= 10000)
);

-- CHECK with NOT IN (should be constraint, not enum)
CREATE TABLE `users` (
  `user_id` int PRIMARY KEY,
  `username` varchar(50),
  `role` varchar(20) CHECK (`role` NOT IN ('banned', 'suspended'))
);

-- ALTER TABLE ADD CONSTRAINT CHECK
CREATE TABLE `accounts` (
  `account_id` int PRIMARY KEY,
  `balance` decimal(15,2)
);

ALTER TABLE `accounts`
  ADD CONSTRAINT chk_balance_positive
  CHECK (`balance` >= 0);

ALTER TABLE `accounts`
  ADD CHECK (`balance` <= 1000000);

-- CHECK with complex expressions
CREATE TABLE `transactions` (
  `txn_id` int PRIMARY KEY,
  `amount` decimal(10,2),
  `fee` decimal(10,2),
  `type` varchar(20),
  CHECK (`amount` + `fee` > 0),
  CHECK (`type` IN ('debit', 'credit'))
);

-- CHECK with OR operator
CREATE TABLE `settings` (
  `setting_id` int PRIMARY KEY,
  `value` int,
  CHECK (`value` = 0 OR `value` = 1 OR `value` = -1)
);

-- CHECK with LIKE operator
CREATE TABLE `contacts` (
  `contact_id` int PRIMARY KEY,
  `email` varchar(100) CHECK (`email` LIKE '%@%.%'),
  `phone` varchar(20) CHECK (`phone` REGEXP '^[0-9]{3}-[0-9]{3}-[0-9]{4}$')
);

-- CHECK with nested parentheses
CREATE TABLE `ranges` (
  `range_id` int PRIMARY KEY,
  `min_val` int,
  `max_val` int,
  CHECK ((`min_val` >= 0) AND (`max_val` <= 100) AND (`min_val` < `max_val`))
);

-- Table-level CHECK with single column IN
CREATE TABLE `shipments` (
  `shipment_id` int PRIMARY KEY,
  `priority` varchar(20),
  `carrier` varchar(50),
  CHECK (`priority` IN ('low', 'medium', 'high', 'urgent'))
);

-- Table-level CHECK with same column in multiple IN clauses
CREATE TABLE `workflow` (
  `workflow_id` int PRIMARY KEY,
  `status` varchar(20),
  `category` varchar(50),
  CHECK (`status` IN ('draft', 'pending') AND `status` IN ('active', 'inactive'))
);
