-- Create person lifespans table for deceased actors
CREATE TABLE public.person_lifespans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tmdb_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  birth_date DATE,
  death_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.person_lifespans ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Person lifespans are publicly readable" 
ON public.person_lifespans 
FOR SELECT 
USING (true);

-- Create policy to restrict modifications to functions only
CREATE POLICY "Only functions can modify person lifespans" 
ON public.person_lifespans 
FOR ALL 
USING (false);

-- Add trigger for updated_at
CREATE TRIGGER update_person_lifespans_updated_at
BEFORE UPDATE ON public.person_lifespans
FOR EACH ROW
EXECUTE FUNCTION public.update_oscar_cache_updated_at();

-- Insert key deceased actors starting with Steve McQueen
INSERT INTO public.person_lifespans (tmdb_id, name, birth_date, death_date) VALUES 
(13565, 'Steve McQueen', '1930-03-24', '1980-11-07'),
(3084, 'Marilyn Monroe', '1926-06-01', '1962-08-05'),
(2176, 'James Dean', '1931-02-08', '1955-09-30'),
(2638, 'Clark Gable', '1901-02-01', '1960-11-16'),
(11232, 'John Wayne', '1907-05-26', '1979-06-11'),
(11357, 'Humphrey Bogart', '1899-12-25', '1957-01-14'),
(11408, 'Gary Cooper', '1901-05-07', '1961-05-13'),
(2216, 'Spencer Tracy', '1900-04-05', '1967-06-10'),
(3064, 'Cary Grant', '1904-01-18', '1986-11-29'),
(11181, 'Jimmy Stewart', '1908-05-20', '1997-07-02');

-- Create index for performance
CREATE INDEX idx_person_lifespans_tmdb_id ON public.person_lifespans(tmdb_id);
CREATE INDEX idx_person_lifespans_death_date ON public.person_lifespans(death_date) WHERE death_date IS NOT NULL;