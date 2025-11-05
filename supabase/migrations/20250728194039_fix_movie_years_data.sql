-- Fix movie years for classic Arnold Schwarzenegger and other 80s/90s movies
-- This will allow the OMDB API to properly identify and fetch rating data

UPDATE draft_picks SET movie_year = 1987 WHERE movie_title = 'Predator';
UPDATE draft_picks SET movie_year = 1984 WHERE movie_title = 'The Terminator';
UPDATE draft_picks SET movie_year = 1990 WHERE movie_title = 'Kindergarten Cop';
UPDATE draft_picks SET movie_year = 1990 WHERE movie_title = 'Total Recall';
UPDATE draft_picks SET movie_year = 1988 WHERE movie_title = 'Twins';
UPDATE draft_picks SET movie_year = 1982 WHERE movie_title = 'Conan the Barbarian';
UPDATE draft_picks SET movie_year = 1991 WHERE movie_title = 'Terminator 2: Judgment Day';
UPDATE draft_picks SET movie_year = 1987 WHERE movie_title = 'The Running Man';
UPDATE draft_picks SET movie_year = 1994 WHERE movie_title = 'True Lies';
UPDATE draft_picks SET movie_year = 1993 WHERE movie_title = 'Last Action Hero';

-- Also fix any other common classic movies that might be in the database
UPDATE draft_picks SET movie_year = 2000 WHERE movie_title = 'Gladiator';
UPDATE draft_picks SET movie_year = 2008 WHERE movie_title = 'The Dark Knight';
UPDATE draft_picks SET movie_year = 1994 WHERE movie_title = 'Forrest Gump';
UPDATE draft_picks SET movie_year = 2004 WHERE movie_title = 'Eternal Sunshine of the Spotless Mind';
UPDATE draft_picks SET movie_year = 2012 WHERE movie_title = 'The Master';
UPDATE draft_picks SET movie_year = 2000 WHERE movie_title = 'American Psycho';
UPDATE draft_picks SET movie_year = 2013 WHERE movie_title = 'American Hustle';
UPDATE draft_picks SET movie_year = 2004 WHERE movie_title = 'The Passion of the Christ';
UPDATE draft_picks SET movie_year = 2006 WHERE movie_title = 'The Da Vinci Code';
UPDATE draft_picks SET movie_year = 2004 WHERE movie_title = 'Spider-Man 2';
UPDATE draft_picks SET movie_year = 2015 WHERE movie_title = 'Bridge of Spies';