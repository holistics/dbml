CREATE TABLE `t` (
  `id` int,
  `id2` int CHECK (id2 /* `x` */ > 0),
  INDEX `t_block_comment` ((id /* `id` */ + 1)),
  INDEX `t_line_comment` ((id -- `id`
    + 1)),
  INDEX `t_hash_comment` ((id # `id`
    + 1)),
  CHECK (id /* `x` */ > 0)
);

ALTER TABLE `t` ADD CONSTRAINT `t_id_check` CHECK (id /* `x` */ < 100);
