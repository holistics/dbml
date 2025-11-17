CREATE TABLE films (
  title varchar,
  content varchar
);

Create table points (
  location varchar(255)
);

CREATE UNIQUE INDEX title_idx ON films (title);

CREATE UNIQUE INDEX title_idx ON films (content) INCLUDE (director, rating);

CREATE INDEX ON films ((lower(title)));

CREATE INDEX title_idx_german ON films (title COLLATE "de_DE");

CREATE INDEX title_idx_nulls_low ON films (title NULLS FIRST);

CREATE UNIQUE INDEX title_idx ON films (title) WITH (fillfactor = 70);

CREATE INDEX pointloc
	ON points USING gist (box(location,location));

CREATE INDEX gin_idx ON points USING GIN (locations) WITH (fastupdate = off);
