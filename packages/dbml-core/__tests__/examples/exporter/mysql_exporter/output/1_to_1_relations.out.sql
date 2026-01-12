CREATE TABLE `father` (
  `obj_id` char(50) UNIQUE PRIMARY KEY
);

CREATE TABLE `child` (
  `obj_id` char(50) UNIQUE PRIMARY KEY,
  `father_obj_id` char(50)
);

ALTER TABLE `child` ADD FOREIGN KEY (`father_obj_id`) REFERENCES `father` (`obj_id`);
