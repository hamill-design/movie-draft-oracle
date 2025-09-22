-- Add Gregory Peck to person_lifespans table to enable proper posthumous filtering
INSERT INTO public.person_lifespans (name, tmdb_id, birth_date, death_date)
VALUES ('Gregory Peck', 3636, '1916-04-05', '2003-06-12')
ON CONFLICT (tmdb_id) DO UPDATE SET
  name = EXCLUDED.name,
  birth_date = EXCLUDED.birth_date,
  death_date = EXCLUDED.death_date;