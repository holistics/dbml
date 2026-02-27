CREATE OR REPLACE FUNCTION "public"."increment"("len_from" integer, "len_to" integer)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
AS $$
DECLARE
          film_count INTEGER;
      BEGIN
          SELECT COUNT(*)
          INTO film_count
          FROM film
          WHERE length BETWEEN len_from AND len_to;
          RETURN film_count;
      END;
$$;

CREATE OR REPLACE FUNCTION "public"."simple_add"("a" integer, "b" integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
AS $$
BEGIN
        RETURN a + b;
      END;
$$;
