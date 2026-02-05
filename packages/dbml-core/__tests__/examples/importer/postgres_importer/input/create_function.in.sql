-- https://github.com/holistics/dbml/issues/436
CREATE FUNCTION public.myfunction() RETURNS void
    LANGUAGE sql
    AS $$
        -- Do something
    $$;
-- https://github.com/holistics/dbml/issues/553
CREATE FUNCTION public.my_func_max_42() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
          IF (SELECT SUM(mycounter::int) FROM mytable) > NEW.mycounter::int > 42
          THEN Raise Exception 'Sum must be lower than 42';
          END IF;
          RETURN NEW;
        END;
        $$;

CREATE TABLE test_table (
  id integer PRIMARY KEY,
  name varchar(100)
);
