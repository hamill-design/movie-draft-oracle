// Runs the REAL enrich-movie-data edge function in Node, with the movie-data websites and the database faked.
//
// What this protects: the function writes a film's score onto EVERY draft that picked it. When a data source stops
// returning a value (Rotten Tomatoes stopped coming back from OMDb in November 2026) the score must keep using the
// last value saved on the film's picks, or old drafts are quietly re-scored without it.

import { register } from 'node:module';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

register('./support/loader.mjs', import.meta.url);

const ENV = {
  SUPABASE_URL: 'http://fake.supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  OMDB_API_KEY: 'omdb-key',   // no TMDB key: the TMDB step is skipped, so only the ratings matter here
};
let handler;
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (fn) => { handler = fn; } };

let savedPicks;      // what draft_picks already holds for the film
let updates;         // what the function wrote
let omdbAnswer;      // what the (fake) OMDb says

const fakeTable = (name) => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve) => resolve({ data: name === 'draft_picks' ? savedPicks : [], error: null }),
  };
  return {
    ...chain,
    update: (data) => ({
      eq: async (column, value) => { updates.push({ table: name, data, column, value }); return { error: null }; },
    }),
  };
};
globalThis.__fakeSupabase = { createClient: () => ({ from: (name) => fakeTable(name) }) };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('omdbapi.com')) return new Response(JSON.stringify(omdbAnswer), { status: 200 });
  return new Response('{}', { status: 404 });
};

await import('../functions/enrich-movie-data/index.ts');
assert.equal(typeof handler, 'function');

const enrich = async (movieId = 424783) => {
  const log = console.log;
  console.log = () => {};   // the function is chatty
  try {
    const res = await handler(new Request('http://localhost/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, movieTitle: 'Test Film', movieYear: 2018 }),
    }));
    return { status: res.status, body: await res.json() };
  } finally {
    console.log = log;
  }
};

const omdb = (ratings = {}) => ({
  Response: 'True', Title: 'Test Film', Year: '2018', imdbRating: ratings.imdb ?? '7.0',
  Ratings: [
    { Source: 'Internet Movie Database', Value: `${ratings.imdb ?? '7.0'}/10` },
    ...(ratings.rt ? [{ Source: 'Rotten Tomatoes', Value: `${ratings.rt}%` }] : []),
    ...(ratings.meta ? [{ Source: 'Metacritic', Value: `${ratings.meta}/100` }] : []),
  ],
});

describe('enrich-movie-data keeps what it already knows about a film', () => {
  beforeEach(() => { savedPicks = []; updates = []; omdbAnswer = omdb({ imdb: '7.0', meta: 66 }); });

  test('with every source answering, nothing changes: the fresh values are used and saved', async () => {
    omdbAnswer = omdb({ imdb: '7.0', rt: 90, meta: 66 });
    const { status, body } = await enrich();
    assert.equal(status, 200);
    assert.equal(body.enrichmentData.rtCriticsScore, 90);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].data.rt_critics_score, 90);
    assert.equal(updates[0].column, 'movie_id');
  });

  test('when Rotten Tomatoes is no longer returned, the saved score is used (and counts in the score)', async () => {
    const withoutRt = await enrich();                       // nothing saved: scored from Metacritic and IMDb only
    assert.equal(withoutRt.body.enrichmentData.rtCriticsScore, null);
    const scoreWithoutRt = withoutRt.body.enrichmentData.calculatedScore;

    savedPicks = [{ rt_critics_score: 96, metacritic_score: 66, imdb_rating: 7, movie_budget: null, movie_revenue: null }];
    updates = [];
    const kept = await enrich();
    assert.equal(kept.body.enrichmentData.rtCriticsScore, 96, 'the saved Rotten Tomatoes score is kept');
    assert.notEqual(kept.body.enrichmentData.calculatedScore, scoreWithoutRt, 'and it is part of the score again');
    assert.equal(updates[0].data.rt_critics_score, 96, 'saved again, unchanged, on every pick of the film');
  });

  test('a fresh value always wins over a saved one', async () => {
    savedPicks = [{ rt_critics_score: 50, metacritic_score: 40, imdb_rating: 5, movie_budget: null, movie_revenue: null }];
    omdbAnswer = omdb({ imdb: '8.0', rt: 91, meta: 77 });
    const { body } = await enrich();
    assert.equal(body.enrichmentData.rtCriticsScore, 91);
    assert.equal(body.enrichmentData.metacriticScore, 77);
    assert.equal(body.enrichmentData.imdbRating, 8);
  });

  test('a source that fails for a moment does not wipe the score: the saved values are used', async () => {
    savedPicks = [{ rt_critics_score: 88, metacritic_score: 72, imdb_rating: 7.5, movie_budget: 100, movie_revenue: 500 }];
    omdbAnswer = { Response: 'False', Error: 'Request limit reached!' };
    const { body } = await enrich();
    assert.equal(body.enrichmentData.rtCriticsScore, 88);
    assert.equal(body.enrichmentData.metacriticScore, 72);
    assert.equal(body.enrichmentData.imdbRating, 7.5);
    assert.ok(body.enrichmentData.calculatedScore > 0, 'a real score, not zero');
  });

  test('the newest saved value is the one kept', async () => {
    savedPicks = [
      { rt_critics_score: null, metacritic_score: 70, imdb_rating: 7, movie_budget: null, movie_revenue: null },   // newest, no RT
      { rt_critics_score: 93, metacritic_score: 70, imdb_rating: 7, movie_budget: null, movie_revenue: null },    // older, has RT
    ];
    const { body } = await enrich();
    assert.equal(body.enrichmentData.rtCriticsScore, 93, 'the newest pick that HAS a value');
  });

  test('a film nobody has a Rotten Tomatoes score for is still scored, from what there is', async () => {
    savedPicks = [{ rt_critics_score: null, metacritic_score: null, imdb_rating: null, movie_budget: null, movie_revenue: null }];
    const { status, body } = await enrich();
    assert.equal(status, 200);
    assert.equal(body.enrichmentData.rtCriticsScore, null);
    assert.ok(body.enrichmentData.calculatedScore > 0);
  });
});
