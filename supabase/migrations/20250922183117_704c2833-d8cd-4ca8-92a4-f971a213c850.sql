-- Create manual Oscar database for classic stars to supplement OMDb data
CREATE TABLE IF NOT EXISTS public.classic_oscar_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name text NOT NULL,
  movie_title text NOT NULL,
  movie_year integer NOT NULL,
  oscar_status text NOT NULL CHECK (oscar_status IN ('winner', 'nominee')),
  category text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(person_name, movie_title, movie_year, oscar_status)
);

-- Enable RLS
ALTER TABLE public.classic_oscar_data ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Classic Oscar data is readable by everyone" 
ON public.classic_oscar_data 
FOR SELECT 
USING (true);

-- Insert known classic star Oscar data
INSERT INTO public.classic_oscar_data (person_name, movie_title, movie_year, oscar_status, category) VALUES
-- Bette Davis
('Bette Davis', 'Dangerous', 1935, 'winner', 'Best Actress'),
('Bette Davis', 'Jezebel', 1938, 'winner', 'Best Actress'),
('Bette Davis', 'Dark Victory', 1939, 'nominee', 'Best Actress'),
('Bette Davis', 'The Letter', 1940, 'nominee', 'Best Actress'),
('Bette Davis', 'The Little Foxes', 1941, 'nominee', 'Best Actress'),
('Bette Davis', 'Now, Voyager', 1942, 'nominee', 'Best Actress'),
('Bette Davis', 'Mr. Skeffington', 1944, 'nominee', 'Best Actress'),
('Bette Davis', 'All About Eve', 1950, 'nominee', 'Best Actress'),
('Bette Davis', 'The Star', 1952, 'nominee', 'Best Actress'),
('Bette Davis', 'What Ever Happened to Baby Jane?', 1962, 'nominee', 'Best Actress'),

-- Clark Gable  
('Clark Gable', 'It Happened One Night', 1934, 'winner', 'Best Actor'),
('Clark Gable', 'Mutiny on the Bounty', 1935, 'nominee', 'Best Actor'),
('Clark Gable', 'Gone with the Wind', 1939, 'nominee', 'Best Actor'),

-- Katharine Hepburn
('Katharine Hepburn', 'Morning Glory', 1933, 'winner', 'Best Actress'),
('Katharine Hepburn', 'Alice Adams', 1935, 'nominee', 'Best Actress'),
('Katharine Hepburn', 'The Philadelphia Story', 1940, 'nominee', 'Best Actress'),
('Katharine Hepburn', 'Woman of the Year', 1942, 'nominee', 'Best Actress'),
('Katharine Hepburn', 'Adam''s Rib', 1949, 'nominee', 'Best Actress'),
('Katharine Hepburn', 'Pat and Mike', 1952, 'nominee', 'Best Actress'),
('Katharine Hepburn', 'Summertime', 1955, 'nominee', 'Best Actress'),
('Katharine Hepburn', 'The Rainmaker', 1956, 'nominee', 'Best Actress'),
('Katharine Hepburn', 'Suddenly, Last Summer', 1959, 'nominee', 'Best Actress'),
('Katharine Hepburn', 'Long Day''s Journey Into Night', 1962, 'nominee', 'Best Actress'),
('Katharine Hepburn', 'Guess Who''s Coming to Dinner', 1967, 'winner', 'Best Actress'),
('Katharine Hepburn', 'The Lion in Winter', 1968, 'winner', 'Best Actress'),
('Katharine Hepburn', 'On Golden Pond', 1981, 'winner', 'Best Actress'),

-- Cary Grant (surprisingly never won, but many nominations)
('Cary Grant', 'Penny Serenade', 1941, 'nominee', 'Best Actor'),
('Cary Grant', 'None But the Lonely Heart', 1944, 'nominee', 'Best Actor'),

-- Jimmy Stewart
('James Stewart', 'The Philadelphia Story', 1940, 'winner', 'Best Actor'),
('James Stewart', 'It''s a Wonderful Life', 1946, 'nominee', 'Best Actor'),
('James Stewart', 'Harvey', 1950, 'nominee', 'Best Actor'),
('James Stewart', 'Anatomy of a Murder', 1959, 'nominee', 'Best Actor'),

-- Humphrey Bogart
('Humphrey Bogart', 'Casablanca', 1943, 'nominee', 'Best Actor'),
('Humphrey Bogart', 'The African Queen', 1951, 'winner', 'Best Actor'),
('Humphrey Bogart', 'The Caine Mutiny', 1954, 'nominee', 'Best Actor'),

-- Add more classic stars as needed...
('Spencer Tracy', 'Captains Courageous', 1937, 'winner', 'Best Actor'),
('Spencer Tracy', 'Boys Town', 1938, 'winner', 'Best Actor'),
('Spencer Tracy', 'Father of the Bride', 1950, 'nominee', 'Best Actor'),
('Spencer Tracy', 'Bad Day at Black Rock', 1955, 'nominee', 'Best Actor'),
('Spencer Tracy', 'The Old Man and the Sea', 1958, 'nominee', 'Best Actor'),
('Spencer Tracy', 'Inherit the Wind', 1960, 'nominee', 'Best Actor'),
('Spencer Tracy', 'Judgment at Nuremberg', 1961, 'nominee', 'Best Actor'),
('Spencer Tracy', 'Guess Who''s Coming to Dinner', 1967, 'nominee', 'Best Actor')

ON CONFLICT (person_name, movie_title, movie_year, oscar_status) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX idx_classic_oscar_person_name ON public.classic_oscar_data(person_name);
CREATE INDEX idx_classic_oscar_movie_title ON public.classic_oscar_data(movie_title, movie_year);