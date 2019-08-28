ALTER TABLE distributors
	ALTER COLUMN address TYPE varchar(80),
	ALTER COLUMN name TYPE varchar(100);	

ALTER TABLE foo
	ALTER COLUMN foo_timestamp DROP DEFAULT,
	ALTER COLUMN foo_timestamp TYPE timestamp with time zone
	USING
			timestamp with time zone 'epoch' + foo_timestamp * interval '1 second',
	ALTER COLUMN foo_timestamp SET DEFAULT now();

ALTER TABLE distributors ALTER COLUMN street SET NOT NULL;

ALTER TABLE distributors ALTER COLUMN street DROP NOT NULL;

ALTER TABLE distributors ADD CONSTRAINT zipchk CHECK (char_length(zipcode) = 5);

ALTER TABLE distributors ADD CONSTRAINT zipchk CHECK (char_length(zipcode) = 5) NO INHERIT;

ALTER TABLE "distributors" 
	ADD CONSTRAINT "distfk" 
	FOREIGN KEY ("address") REFERENCES "addresses" ("address") 
	NOT VALID;

ALTER TABLE distributors ADD CONSTRAINT dist_id_zipcode_key UNIQUE (dist_id, zipcode);

ALTER TABLE distributors ADD PRIMARY KEY (dist_id);

/* ALTER TABLE distributors
  ADD CONSTRAINT distributors_pkey PRIMARY KEY USING INDEX dist_id_temp_idx; -- need to check about this syntax */

ALTER TABLE distributors ALTER COLUMN STORAGE SET STORAGE EXTENDED;