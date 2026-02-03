create table users (
  identity_data jsonb,
  email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED
);
