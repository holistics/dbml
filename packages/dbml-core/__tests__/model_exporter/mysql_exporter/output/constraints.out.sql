CREATE TABLE `User` (
  `balance` int,
  `name` TEXT,
  `email` TEXT,
  CONSTRAINT `not_too_much_money` CHECK (balance < 10000000),
  CONSTRAINT `name_not_too_long` CHECK (LEN(name) < 256),
  CHECK (REGEXP_LIKE(email, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'))
);

CREATE TABLE `User2` (
  `balance` int,
  CONSTRAINT `not_too_much_money` CHECK (balance < 10000000)
);
