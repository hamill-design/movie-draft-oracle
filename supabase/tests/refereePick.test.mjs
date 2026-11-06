// Tests for the server-side picker (supabase/functions/_shared/refereePick.ts).
// Pure logic: no network, no database. Node strips the TypeScript types on import.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  qualityScore, chooseMovie, getEligibleCategories, selectAutoPick, toPickRecord, getGenreName,
} from '../functions/_shared/refereePick.ts';

const movie = (over = {}) => ({
  id: 1, title: 'Film', year: 1999, genre: 'Comedy',
  voteAverage: 7, vote_count: 2000, ...over,
});
const first = () => 0;     // rng that always picks index 0
const last = () => 0.999;  // rng that always picks the last index

describe('qualityScore (same weights the bots use today)', () => {
  test('well-rated, widely-voted movies outscore poorly-rated ones', () => {
    assert.ok(qualityScore(movie({ voteAverage: 8.5 })) > qualityScore(movie({ voteAverage: 6 })));
  });
  test('few votes are trusted less', () => {
    assert.ok(qualityScore(movie({ vote_count: 5000 })) > qualityScore(movie({ vote_count: 50 })));
  });
  test('Oscar winner +20, nominee +10', () => {
    const base = qualityScore(movie());
    assert.equal(qualityScore(movie({ oscar_status: 'winner' })) - base, 20);
    assert.equal(qualityScore(movie({ oscar_status: 'nominee' })) - base, 10);
    assert.equal(qualityScore(movie({ hasOscar: true })) - base, 10);
  });
  test('blockbuster, budget, revenue and the 1990-2010 bonus', () => {
    const plain = qualityScore(movie({ year: 1975 }));
    assert.equal(qualityScore(movie({ year: 1975, isBlockbuster: true })) - plain, 5);
    assert.equal(qualityScore(movie({ year: 1975, budget: 60_000_000 })) - plain, 3);
    assert.equal(qualityScore(movie({ year: 1975, revenue: 150_000_000 })) - plain, 2);
    assert.equal(qualityScore(movie({ year: 1995 })) - plain, 2);
  });
});

describe('getEligibleCategories (which categories a movie can fill)', () => {
  const all = ['Comedy', 'Animated', 'Action/Adventure', "90's", 'Academy Award Nominee or Winner',
    'Blockbuster (minimum of $50 Mil)', 'Sequel', 'Wild Card'];

  test('decade + genre', () => {
    const got = getEligibleCategories(movie({ year: 1995, genre: 'Comedy Drama' }), all);
    assert.ok(got.includes('Comedy') && got.includes("90's") && got.includes('Wild Card'));
    assert.ok(!got.includes('Animated'));
  });
  test('genre words match whole words only ("animation" is not "action")', () => {
    const got = getEligibleCategories(movie({ genre: 'Animation Family' }), all);
    assert.ok(got.includes('Animated'));
    assert.ok(!got.includes('Action/Adventure'));
  });
  test('Oscar, Blockbuster and Sequel only when the movie qualifies', () => {
    assert.ok(getEligibleCategories(movie({ oscar_status: 'winner' }), all).includes('Academy Award Nominee or Winner'));
    assert.ok(!getEligibleCategories(movie({ oscar_status: 'none' }), all).includes('Academy Award Nominee or Winner'));
    assert.ok(getEligibleCategories(movie({ isBlockbuster: true }), all).includes('Blockbuster (minimum of $50 Mil)'));
    assert.ok(getEligibleCategories(movie({ isSequel: true }), all).includes('Sequel'));
    assert.ok(!getEligibleCategories(movie(), all).includes('Sequel'));
  });
  test('only categories that are in the draft are returned', () => {
    assert.deepEqual(getEligibleCategories(movie({ genre: 'Comedy' }), ['Drama/Romance']), []);
  });
  test('custom actor/spec categories use the tagged movie ids', () => {
    const map = new Map([['Aardman', [42]], ['Comedy', [42]]]);
    const got = getEligibleCategories(movie({ id: 42, tmdbId: 42 }), ['Aardman', 'Comedy'], 'spec-draft', 'sd1', map);
    assert.ok(got.includes('Aardman'));
    // 'Comedy' is a global category, so it must come from the genre, not the custom map
    const notComedy = getEligibleCategories(movie({ id: 42, tmdbId: 42, genre: 'Drama' }), ['Aardman', 'Comedy'], 'spec-draft', 'sd1', map);
    assert.ok(!notComedy.includes('Comedy'));
  });
});

describe('chooseMovie', () => {
  const base = { theme: 'all', option: '', currentCategory: 'Comedy', allCategories: ['Comedy'], alreadyPickedMovieIds: [] };

  test('picks the highest-quality eligible movie', () => {
    const movies = [
      movie({ id: 1, voteAverage: 6 }),
      movie({ id: 2, voteAverage: 9, oscar_status: 'winner' }),
      movie({ id: 3, voteAverage: 7.5 }),
    ];
    assert.equal(chooseMovie({ ...base, movies }, first).id, 2);
  });
  test('never picks an already-picked movie', () => {
    const movies = [movie({ id: 2, voteAverage: 9 }), movie({ id: 3, voteAverage: 5 })];
    assert.equal(chooseMovie({ ...base, movies, alreadyPickedMovieIds: [2] }, first).id, 3);
  });
  test('respects the category being filled', () => {
    const movies = [
      movie({ id: 1, voteAverage: 9.5, genre: 'Horror' }),
      movie({ id: 2, voteAverage: 6, genre: 'Comedy' }),
    ];
    assert.equal(chooseMovie({ ...base, movies }, first).id, 2);
  });
  test('skips movies with unknown genre when the category is a genre category', () => {
    const movies = [movie({ id: 1, voteAverage: 9.5, genre: 'Unknown' }), movie({ id: 2, voteAverage: 6 })];
    assert.equal(chooseMovie({ ...base, movies }, first).id, 2);
  });
  test('year drafts: a re-release from another year can never be picked', () => {
    const movies = [movie({ id: 1, year: 2019, voteAverage: 9.5 }), movie({ id: 2, year: 2015, voteAverage: 6 })];
    const pick = chooseMovie({ ...base, theme: 'year', option: '2015', movies }, first);
    assert.equal(pick.id, 2);
  });
  test('when nothing fits the category, falls back to the best remaining movie so the draft can finish', () => {
    const movies = [movie({ id: 1, genre: 'Horror', voteAverage: 9 }), movie({ id: 2, genre: 'Horror', voteAverage: 5 })];
    assert.equal(chooseMovie({ ...base, movies }, first).id, 1);
  });
  test('returns null when there is nothing left', () => {
    assert.equal(chooseMovie({ ...base, movies: [] }, first), null);
    assert.equal(chooseMovie({ ...base, movies: [movie({ id: 1 })], alreadyPickedMovieIds: [1] }, first), null);
  });
  test('adds variety among the top 3 only when they are close in quality', () => {
    const close = [movie({ id: 1, voteAverage: 8 }), movie({ id: 2, voteAverage: 7.8 }), movie({ id: 3, voteAverage: 7.7 })];
    assert.equal(chooseMovie({ ...base, movies: close }, first).id, 1);
    assert.equal(chooseMovie({ ...base, movies: close }, last).id, 3);
    // a clear leader is always taken, whatever the dice say
    const clear = [movie({ id: 1, voteAverage: 9, oscar_status: 'winner' }), movie({ id: 2, voteAverage: 6 }), movie({ id: 3, voteAverage: 5.5 })];
    assert.equal(chooseMovie({ ...base, movies: clear }, last).id, 1);
  });
  test('does not change the list it was given', () => {
    const movies = [movie({ id: 1, voteAverage: 5 }), movie({ id: 2, voteAverage: 9 })];
    chooseMovie({ ...base, movies }, first);
    assert.deepEqual(movies.map((m) => m.id), [1, 2]);
  });
});

describe('toPickRecord (what gets stored)', () => {
  test('fills in the same defaults the browser uses', () => {
    const r = toPickRecord({ id: 9, title: 'X' }, new Date('2026-06-01'));
    assert.deepEqual(r, { id: 9, title: 'X', year: 2026, genre: 'Unknown', posterPath: null });
  });
  test('uses whichever poster field is present', () => {
    assert.equal(toPickRecord(movie({ posterPath: '/a.jpg' })).posterPath, '/a.jpg');
    assert.equal(toPickRecord(movie({ poster_path: '/b.jpg' })).posterPath, '/b.jpg');
  });
});

describe('selectAutoPick (the whole decision, with a fake data source)', () => {
  const fakeSource = (over = {}) => ({
    specDraftMovies: async () => [],
    specDraftMovieIdsForCategory: async () => [],
    specDraftMoviesWithCategories: async () => [],
    actorSpecCategories: async () => [],
    fetchMovies: async () => ({ results: [] }),
    ...over,
  });

  test('year draft: asks fetch-movies for that year and picks within it', async () => {
    let body;
    const source = fakeSource({
      fetchMovies: async (b) => { body = b; return { results: [
        movie({ id: 1, year: 2001, voteAverage: 9 }), movie({ id: 2, year: 1999, voteAverage: 6 }),
      ] }; },
    });
    const r = await selectAutoPick(source, { theme: 'year', option: '1999', categories: ['Comedy'], openCategories: ['Comedy'], pickedMovieIds: [] }, first);
    assert.equal(body.category, 'year');
    assert.equal(body.searchQuery, '1999');
    assert.equal(r.movie.id, 2);
    assert.equal(r.category, 'Comedy');
  });

  test('chooses one of the categories the player has not filled', async () => {
    const source = fakeSource({ fetchMovies: async () => ({ results: [movie({ id: 1, genre: 'Comedy Drama' })] }) });
    const r = await selectAutoPick(source, {
      theme: 'all', option: '', categories: ['Comedy', 'Drama/Romance', 'Horror/Thriller'],
      openCategories: ['Comedy', 'Drama/Romance'], pickedMovieIds: [],
    }, first);
    assert.ok(['Comedy', 'Drama/Romance'].includes(r.category));
  });

  test('returns null when every movie in the pool is already picked', async () => {
    const source = fakeSource({ fetchMovies: async () => ({ results: [movie({ id: 1, genre: 'Comedy' })] }) });
    const r = await selectAutoPick(source, {
      theme: 'all', option: '', categories: ['Comedy'], openCategories: ['Comedy'], pickedMovieIds: [1],
    }, first);
    assert.equal(r, null);
  });

  test('moves on to the next category when the first one has nothing to offer', async () => {
    const rows = [
      { id: 'a', movie_tmdb_id: 11, movie_title: 'Clay One', movie_year: 2000, movie_poster_path: null, movie_genres: [16], is_sequel: false },
    ];
    const source = fakeSource({
      specDraftMovies: async () => rows,
      // 'Ghost' is tagged only on a movie that isn't in this draft; 'Clay' is tagged on movie 'a'
      specDraftMovieIdsForCategory: async (c) => (c === 'Ghost' ? ['zzz'] : c === 'Clay' ? ['a'] : []),
      specDraftMoviesWithCategories: async () => [{ movie_tmdb_id: 11, categories: ['Clay'] }],
    });
    // rng = 0.999 keeps the category order as given: Ghost first, then Clay
    const r = await selectAutoPick(source, {
      theme: 'spec-draft', option: 'sd1', categories: ['Ghost', 'Clay'], openCategories: ['Ghost', 'Clay'], pickedMovieIds: [],
    }, last);
    assert.equal(r.category, 'Clay');
    assert.equal(r.movie.id, 11);
  });

  test('people draft: loads that actor\'s custom categories', async () => {
    let asked;
    const source = fakeSource({
      fetchMovies: async () => ({ results: [movie({ id: 7, tmdbId: 7, genre: 'Drama', voteAverage: 5 }), movie({ id: 8, tmdbId: 8, genre: 'Drama', voteAverage: 9 })] }),
      actorSpecCategories: async (name) => { asked = name; return [{ category_name: 'Heist', movie_tmdb_ids: [7] }]; },
    });
    const r = await selectAutoPick(source, {
      theme: 'people', option: 'George Clooney', categories: ['Heist', 'Drama/Romance'],
      openCategories: ['Heist'], pickedMovieIds: [],
    }, first);
    assert.equal(asked, 'George Clooney');
    assert.equal(r.movie.id, 7, 'only movie 7 is tagged Heist, even though 8 is better rated');
  });

  test('spec draft: only offers movies tagged for the category, when tags exist', async () => {
    const rows = [
      { id: 'a', movie_tmdb_id: 11, movie_title: 'Clay One', movie_year: 2000, movie_poster_path: '/c.jpg', movie_genres: [16], is_sequel: false },
      { id: 'b', movie_tmdb_id: 12, movie_title: 'Other', movie_year: 2001, movie_poster_path: null, movie_genres: [35], is_sequel: false },
    ];
    const source = fakeSource({
      specDraftMovies: async () => rows,
      specDraftMovieIdsForCategory: async (c) => (c === 'Clay' ? ['a'] : []),
      specDraftMoviesWithCategories: async () => [{ movie_tmdb_id: 11, categories: ['Clay'] }],
    });
    const r = await selectAutoPick(source, { theme: 'spec-draft', option: 'sd1', categories: ['Clay'], openCategories: ['Clay'], pickedMovieIds: [] }, first);
    assert.equal(r.movie.id, 11);
    assert.equal(r.movie.posterPath, '/c.jpg');
    assert.equal(r.movie.genre, 'Animation');
  });

  test('returns null (never throws) when there is simply nothing to pick', async () => {
    const r = await selectAutoPick(fakeSource(), { theme: 'year', option: '1999', categories: ['Comedy'], openCategories: ['Comedy'], pickedMovieIds: [] }, first);
    assert.equal(r, null);
  });

  test('falls back to all categories if the player has no open ones recorded', async () => {
    const source = fakeSource({ fetchMovies: async () => ({ results: [movie({ id: 1 })] }) });
    const r = await selectAutoPick(source, { theme: 'all', option: '', categories: ['Comedy'], openCategories: [], pickedMovieIds: [] }, first);
    assert.equal(r.category, 'Comedy');
  });
});

test('genre ids map to names', () => {
  assert.equal(getGenreName(16), 'Animation');
  assert.equal(getGenreName(999999), 'Unknown');
});
