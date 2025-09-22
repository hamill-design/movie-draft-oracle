-- Add missing classic Hollywood actors to person_lifespans table
-- Focus on major stars who are likely to appear in themed drafts

INSERT INTO public.person_lifespans (tmdb_id, name, birth_date, death_date) VALUES
-- Female Classic Stars
(3084, 'Bette Davis', '1908-04-05', '1989-10-06'),
(3092, 'Joan Crawford', '1904-03-23', '1977-05-10'),
(3093, 'Katharine Hepburn', '1907-05-12', '2003-06-29'),
(11207, 'Grace Kelly', '1929-11-12', '1982-09-14'),
(11224, 'Ingrid Bergman', '1915-08-29', '1982-08-29'),
(11291, 'Judy Garland', '1922-06-10', '1969-06-22'),
(11347, 'Marilyn Monroe', '1926-06-01', '1962-08-04'),
(11356, 'Elizabeth Taylor', '1932-02-27', '2011-03-23'),
(11384, 'Audrey Hepburn', '1929-05-04', '1993-01-20'),
(11664, 'Rita Hayworth', '1918-10-17', '1987-05-14'),
(11701, 'Lauren Bacall', '1924-09-16', '2014-08-12'),
(12133, 'Greta Garbo', '1905-09-18', '1990-04-15'),
(12835, 'Mae West', '1893-08-17', '1980-11-22'),
(13846, 'Jean Harlow', '1911-03-03', '1937-06-07'),

-- Male Classic Stars (additional to existing)
(2888, 'Will Rogers', '1879-11-04', '1935-08-15'),
(3084, 'Clark Gable', '1901-02-01', '1960-11-16'),
(3087, 'James Stewart', '1908-05-20', '1997-07-02'),
(3088, 'Spencer Tracy', '1900-04-05', '1967-06-10'),
(3895, 'Gary Cooper', '1901-05-07', '1961-05-13'),
(4165, 'Henry Fonda', '1905-05-16', '1982-08-12'),
(5293, 'John Wayne', '1907-05-26', '1979-06-11'),
(11288, 'Cary Grant', '1904-01-18', '1986-11-29'),
(11317, 'Humphrey Bogart', '1899-12-25', '1957-01-14'),
(11356, 'James Dean', '1931-02-08', '1955-09-30'),
(12073, 'Errol Flynn', '1909-06-20', '1959-10-14'),
(12154, 'Fred Astaire', '1899-05-10', '1987-06-22'),
(12155, 'Gene Kelly', '1912-08-23', '1996-02-02'),
(13240, 'Charlie Chaplin', '1889-04-16', '1977-12-25'),
(13848, 'Buster Keaton', '1895-10-04', '1966-02-01')

ON CONFLICT (tmdb_id) DO UPDATE SET
  name = EXCLUDED.name,
  birth_date = EXCLUDED.birth_date,
  death_date = EXCLUDED.death_date,
  updated_at = now();