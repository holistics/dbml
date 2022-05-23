CREATE TABLE `authors` (
  `id` int PRIMARY KEY,
  `name` varchar(255),
  `dob` date,
  `gender` varchar(255)
);

CREATE TABLE `books` (
  `id` int PRIMARY KEY,
  `release_date` date,
  `title` varchar(255)
);

CREATE TABLE `authors_books` (
  `authors_id` int NOT NULL,
  `books_id` int NOT NULL,
  CONSTRAINT PK_authors_books PRIMARY KEY (`authors_id`, `books_id`)
);

ALTER TABLE `authors_books` ADD FOREIGN KEY (`authors_id`) REFERENCES `authors` (`id`);

ALTER TABLE `authors_books` ADD FOREIGN KEY (`books_id`) REFERENCES `books` (`id`);

