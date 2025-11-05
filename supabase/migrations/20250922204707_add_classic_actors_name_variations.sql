-- Add James Stewart and other classic actors with name variations to person_lifespans table
-- This ensures proper posthumous filtering for classic actors

-- James Stewart (currently stored as "Jimmy Stewart" but searched as "James Stewart")
INSERT INTO public.person_lifespans (name, tmdb_id, birth_date, death_date)
VALUES ('James Stewart', 3636, '1908-05-20', '1997-07-02')
ON CONFLICT (tmdb_id) DO UPDATE SET
  name = EXCLUDED.name,
  birth_date = EXCLUDED.birth_date,
  death_date = EXCLUDED.death_date;

-- Add Henry Fonda (mentioned in logs as not found)
INSERT INTO public.person_lifespans (name, tmdb_id, birth_date, death_date)
VALUES ('Henry Fonda', 4958, '1905-05-16', '1982-08-12')
ON CONFLICT (tmdb_id) DO UPDATE SET
  name = EXCLUDED.name,
  birth_date = EXCLUDED.birth_date,
  death_date = EXCLUDED.death_date;

-- Add other major classic actors that might have similar issues
INSERT INTO public.person_lifespans (name, tmdb_id, birth_date, death_date)
VALUES 
  ('Cary Grant', 2178, '1904-01-18', '1986-11-29'),
  ('Humphrey Bogart', 4110, '1899-12-25', '1957-01-14'),
  ('Clark Gable', 1596, '1901-02-01', '1960-11-16'),
  ('Spencer Tracy', 1821, '1900-04-05', '1967-06-10'),
  ('John Wayne', 4165, '1907-05-26', '1979-06-11'),
  ('Gary Cooper', 2153, '1901-05-07', '1961-05-13'),
  ('William Holden', 11025, '1918-04-17', '1981-11-12'),
  ('Burt Lancaster', 4135, '1913-11-02', '1994-10-20')
ON CONFLICT (tmdb_id) DO UPDATE SET
  name = EXCLUDED.name,
  birth_date = EXCLUDED.birth_date,
  death_date = EXCLUDED.death_date;

-- Create an actor name aliases table for handling name variations
CREATE TABLE IF NOT EXISTS public.actor_name_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_name text NOT NULL,
  alias_name text NOT NULL,
  tmdb_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(alias_name, tmdb_id)
);

-- Enable RLS for the aliases table
ALTER TABLE public.actor_name_aliases ENABLE ROW LEVEL SECURITY;

-- Create policy for aliases table (read-only for functions)
CREATE POLICY "Actor name aliases are publicly readable" ON public.actor_name_aliases
  FOR SELECT USING (true);

CREATE POLICY "Only functions can modify actor name aliases" ON public.actor_name_aliases
  FOR ALL USING (false);

-- Insert common name variations
INSERT INTO public.actor_name_aliases (primary_name, alias_name, tmdb_id)
VALUES 
  ('James Stewart', 'Jimmy Stewart', 3636),
  ('James Stewart', 'Jim Stewart', 3636),
  ('Gregory Peck', 'Greg Peck', 3636),
  ('Henry Fonda', 'Hank Fonda', 4958),
  ('Humphrey Bogart', 'Bogie', 4110),
  ('Humphrey Bogart', 'Humphrey DeForest Bogart', 4110),
  ('William Holden', 'Bill Holden', 11025),
  ('William Holden', 'William Franklin Holden', 11025)
ON CONFLICT (alias_name, tmdb_id) DO NOTHING;