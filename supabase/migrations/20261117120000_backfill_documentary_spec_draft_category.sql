-- Documentary is now a standard spec draft category (admin manager, setup page and the auto-tagging rule
-- in src/utils/specDraftGenreMapper.ts all know it). Movies added from here on get the tag automatically;
-- this tags the movies already in spec drafts: every spec_draft_movie whose TMDB genres include
-- Documentary (genre id 99) gets the same "Documentary" tag the admin "add movie" button would give it.
-- Safe to run more than once; existing tags are left alone.
INSERT INTO public.spec_draft_movie_categories (spec_draft_movie_id, category_name, is_automated)
SELECT m.id, 'Documentary', true
FROM public.spec_draft_movies m
WHERE 99 = ANY (m.movie_genres)
ON CONFLICT (spec_draft_movie_id, category_name) DO NOTHING;

-- Check: how many movies per spec draft now carry the tag.
SELECT sd.name, count(*) AS documentaries
FROM public.spec_draft_movie_categories c
JOIN public.spec_draft_movies m ON m.id = c.spec_draft_movie_id
JOIN public.spec_drafts sd ON sd.id = m.spec_draft_id
WHERE c.category_name = 'Documentary'
GROUP BY sd.name
ORDER BY documentaries DESC;
