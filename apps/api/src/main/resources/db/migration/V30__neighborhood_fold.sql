-- Neighborhood search that forgives how people type: "agdal", " Agdal " and
-- "AGDAL" find "Agdal", and "medina" finds "Médina". The column stays free
-- text (V20 left enforcement for later); searches compare folded values.
--
-- unaccent is a contrib extension shipped with PostgreSQL and available on
-- Amazon RDS. Its one-argument form depends on search_path, so it is STABLE;
-- naming the dictionary makes the result depend on the input alone, which is
-- what lets dari_fold be IMMUTABLE and usable in an index should one be needed.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE FUNCTION dari_fold(value TEXT) RETURNS TEXT
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
    SELECT lower(regexp_replace(btrim(public.unaccent('public.unaccent'::regdictionary, value)), '\s+', ' ', 'g'))
$$;
