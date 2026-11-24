-- ============================================================
-- A longer list of names public play refuses.
--
-- The starter list in 20261105100000_public_play_foundation.sql had 17 terms. This adds about 70 more:
-- insults, sexual words, slurs, hate-group codes, and words that make a player look like staff.
-- It is still a first pass, not a complete list. The Report button is the safety net for what it misses,
-- and anyone can add more with one line (see the end of this file).
--
-- How the filter reads a name (unchanged, see _name_problem): it lowercases the name, turns look-alikes
-- back into letters (0 o, 1 i, 3 e, 4 a, 5 s, 7 t, @ a, $ s, ! i), drops everything that is not a letter,
-- then checks every term.
--   whole_word = false  the term is refused anywhere inside the name ("fuckface", "f.u.c.k").
--                       Used only for long, distinctive words, so nobody is refused by accident.
--   whole_word = true   the term is refused only as a whole word ("Mr Dick", but not "Dickens").
--                       Used for short words that sit inside ordinary names (ass in Cassidy, cum in
--                       Cumberbatch, mod in Modern Times, rape in Grape Ape, coon in Raccoon).
--
-- Names a player already has are not re-checked; the filter runs when a name is chosen or changed.
-- To see whether any existing name would now be refused (read only, safe to run any time):
--   select id, public_name from public.profiles
--   where public_name is not null and public._name_problem(public_name, id) is not null;
--
-- Safe to run twice (a term that is already in the list is skipped). Needs 20261105100000 first.
-- Adds rows to one table; nothing existing is changed or removed.
-- ============================================================

INSERT INTO public.blocked_name_terms (term, whole_word) VALUES
  -- Insults and swearing (long enough to refuse anywhere in a name)
  ('asshole', false), ('bastard', false), ('dickhead', false), ('pussy', false),
  ('bollocks', false), ('bellend', false), ('phuck', false), ('motherfuck', false),
  -- Insults and swearing (short, whole word only)
  ('slut', true), ('sluts', true), ('twat', true), ('wank', true), ('wanker', true),
  ('arse', true), ('fck', true), ('fuk', true), ('shyt', true), ('biatch', true),
  -- Sexual words (long)
  ('cocksuck', false), ('blowjob', false), ('handjob', false), ('dildo', false),
  ('jizz', false), ('orgasm', false), ('masturbat', false), ('cumshot', false),
  ('gangbang', false), ('hentai', false), ('prostitute', false),
  -- Sexual words (short, whole word only)
  ('anal', true), ('anus', true), ('cum', true), ('milf', true), ('penis', true),
  ('vagina', true), ('boob', true), ('boobs', true), ('boner', true), ('tits', true),
  ('sexy', true), ('hooker', true),
  -- Slurs (long)
  ('nigger', false), ('nigga', false), ('faggot', false), ('retard', false),
  ('tranny', false), ('wetback', false), ('towelhead', false), ('raghead', false),
  -- Slurs (short, whole word only)
  ('fag', true), ('kike', true), ('spic', true), ('chink', true), ('gook', true),
  ('coon', true), ('beaner', true), ('paki', true),
  -- Hate groups and hate symbols
  ('kkk', false), ('swastika', false), ('whitepower', false),
  -- Violence against others, and abuse of children
  ('pedophile', false), ('paedophile', false), ('pedo', true), ('paedo', true),
  ('rape', true), ('rapists', true), ('molest', true), ('molester', true), ('incest', true),
  ('killyourself', false), ('kys', true),
  -- Words that make someone look like they work for Movie Drafter ('admin', 'moderator' and
  -- 'moviedrafter' were already in the starter list)
  ('staff', true), ('support', true), ('mod', true), ('customerservice', false)
ON CONFLICT (term) DO NOTHING;

-- To add a word later, run one line in the SQL editor (true = whole word only, false = anywhere in a name):
--   insert into public.blocked_name_terms (term, whole_word) values ('theword', true) on conflict (term) do nothing;
-- To take one out:
--   delete from public.blocked_name_terms where term = 'theword';
