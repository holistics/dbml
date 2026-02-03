create table users (
  identity_data jsonb,
  email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED
);

create table json_operators (
  id serial primary key,
  data jsonb,
  field_text text GENERATED ALWAYS AS (data ->> 'name') STORED,
  field_json jsonb GENERATED ALWAYS AS (data -> 'address') STORED,
  nested_text text GENERATED ALWAYS AS (data #>> '{address,city}') STORED,
  nested_json jsonb GENERATED ALWAYS AS (data #> '{address}') STORED
);

create table other_operators (
  id serial primary key,
  a int,
  b int,
  left_shift int GENERATED ALWAYS AS (a << 2) STORED,
  right_shift int GENERATED ALWAYS AS (b >> 2) STORED,
  gte boolean GENERATED ALWAYS AS (a >= b) STORED,
  lte boolean GENERATED ALWAYS AS (a <= b) STORED,
  neq boolean GENERATED ALWAYS AS (a <> b) STORED,
  as_text text GENERATED ALWAYS AS (a::text) STORED
);
