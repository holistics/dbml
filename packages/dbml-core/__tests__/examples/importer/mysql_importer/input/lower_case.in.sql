create table `orders` (
  `id` int primary key auto_increment,
  `user_id` int unique not null,
  `status` enum ('created', 'running', 'done', 'failure'),
  `created_at` varchar(255)
);

create table `order_items` (
  `order_id` int,
  `product_id` int,
  `quantity` int default 1
);

create table `products` (
  `id` int,
  `name` varchar(255),
  `merchant_id` int not null,
  `price` int comment 'Products price field',
  `status` enum ('Out of Stock', 'In Stock'),
  `created_at` datetime default (now()),
  primary key (`id`, `price`)
) comment = 'Notes about products table';

create table `users` (
  `id` int primary key,
  `full_name` varchar(255),
  `email` varchar(255) unique,
  `gender` varchar(255),
  `date_of_birth` varchar(255),
  `created_at` varchar(255),
  `country_code` int
) comment = 'User basic information';

create table `merchants` (
  `id` int primary key,
  `merchant_name` varchar(255),
  `country_code` int,
  `created_at` varchar(255),
  `admin_id` int
);

create table `countries` (
  `code` int primary key,
  `name` varchar(255),
  `continent_name` varchar(255)
);

create table `composite_service_item` (
  `composite_service_item_id` int(11) not null,
  `service_id` int(11) not null,
  `ticket_item_id` int(11) not null,
  `discount` decimal(10,0) not null,
  `original_price` decimal(10,0) not null,
  `patient_price` decimal(10,0) not null,
  `insurance_price` decimal(10,0) not null,
  primary key  (`composite_service_item_id`),
  key `ticket_item_id` (`ticket_item_id`),
  key `service_id` (`service_id`),
  key `service_id, ticket_item_id` using hash (`service_id`,`ticket_item_id`),
  key `composite_service_item_id` using btree    (`composite_service_item_id`),
  key `test test test key` using hash(`service_id`,`patient_price`)
) engine=MyISAM default charset=utf8 collate=utf8_unicode_ci;

create table `Countries` (
  `Id` int not null,
  `Name` varchar(32) not null,
  primary key (`Id`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

create table `States` (
  `Id` int not null,
  `CountryId` int not null,
  `Name` varchar(32) not null,
  primary key (`Id`,`CountryId`),
  key `IX_States_CountryId` (`CountryId`),
  constraint `FK_States_Countries_CountryId` foreign key (`CountryId`) references `Countries` (`Id`) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

create table `Cities` (
  `Id` int not null,
  `CountryId` int not null,
  `StateId` int not null,
  `Name` varchar(32) not null,
  primary key (`Id`,`StateId`,`CountryId`),
  key `IX_Cities_CountryId` (`CountryId`),
  key `IX_Cities_StateId_CountryId` (`StateId`,`CountryId`),
  constraint `FK_Cities_Countries_CountryId` foreign key (`CountryId`) references `Countries` (`Id`) on delete cascade,
  constraint `FK_Cities_States_StateId_CountryId` foreign key (`StateId`, `CountryId`) references `States` (`Id`, `CountryId`) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

alter table `order_items` add foreign key (`order_id`) references `orders` (`id`);

alter table `order_items` add foreign key (`product_id`) references `products` (`id`);

alter table `users` add foreign key (`country_code`) references `countries` (`code`);

alter table `merchants` add foreign key (`country_code`) references `countries` (`code`);

alter table `products` add foreign key (`merchant_id`) references `merchants` (`id`);

alter table `merchants` add foreign key (`admin_id`) references `users` (`id`);

create index `product_status` ON `products` (`merchant_id`, `status`);

create unique index `products_index_1` ON `products` (`id`) using hash;
