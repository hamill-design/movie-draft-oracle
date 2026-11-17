// Builds the "Food and Drink Movies" spec draft from Wikipedia's "List of films about food and drink".
//
// This script is READ-ONLY against Supabase. It looks each film up on TMDB through the app's own
// `fetch-movies` edge function (same call the admin movie search makes, using the public anon key from
// src/integrations/supabase/client.ts), then writes a SQL file you paste into the Supabase SQL editor.
// No service key needed; nothing is written to the database by running this.
//
//   node create-food-and-drink-spec-draft.js
//
// Env (all optional):
//   REVIEW_DIR   where to write the review report + lookup cache (default: a temp folder)
//   ONLY         comma-separated titles to look up (quick test, writes nothing)
//
// Outputs:
//   create-food-and-drink-spec-draft.sql   idempotent, paste-and-run
//   <REVIEW_DIR>/food-and-drink-review.md  what matched, what needs a decision
//   <REVIEW_DIR>/lookup-cache.json         raw TMDB lookups, so re-runs are instant

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SPEC_DRAFT_NAME = 'Food and Drink Movies';
const SPEC_DRAFT_SLUG = 'food-and-drink-movies';
const SPEC_DRAFT_DESCRIPTION =
  'Films about food and drink: restaurants and chefs, wine, beer, coffee, sweets and everything in between.';
const CUSTOM_CATEGORY = 'Restaurants';

const SQL_OUT = path.resolve('create-food-and-drink-spec-draft.sql');
const REVIEW_DIR = path.resolve(process.env.REVIEW_DIR || path.join(os.tmpdir(), 'food-and-drink-review'));
const CACHE_FILE = path.join(REVIEW_DIR, 'lookup-cache.json');
const REPORT_FILE = path.join(REVIEW_DIR, 'food-and-drink-review.md');

// ---------------------------------------------------------------------------------------------
// Source list: Wikipedia "List of films about food and drink", every section, as the page shows it.
// "Title|2007" adds a year hint where the page's own link disambiguates (e.g. "Black Coffee (2007 film)")
// or the title is shared by several films. Titles are matched against TMDB's title, so the hint only
// has to be within a year of TMDB's release year.
// ---------------------------------------------------------------------------------------------
const SECTIONS = {
  'Documentary films': [
    'All in This Tea', 'American Beer', 'Beer Wars', 'Bill W.', 'A Bite of China', 'Black Coffee|2007',
    'Black Gold|2006', 'Blood into Wine', 'Chez Schwartz', 'Dive!', 'Fat Head',
    'Fine Food, Fine Pastries, Open 6 to 9', 'The Five Obstructions', 'Food, Inc.', 'The Fruit Hunters',
    'Garlic Is as Good as Ten Mothers', 'Global Steak', 'Gutbusters', 'I Like Killing Flies', 'Ingredients',
    'Jiro Dreams of Sushi', 'Kings of Pastry', 'Know Your Mushrooms', 'A Matter of Taste', 'Mondovino',
    "Off the Menu: The Last Days of Chasen's", 'Our Daily Bread|2005', 'Paavo, a Life in Five Courses',
    'Pennsylvania Diners and Other Roadside Restaurants', 'A Place at the Table', 'Red Obsession',
    'The Restaurant Inspector', 'The Search for General Tso', 'Soul Food Junkies', 'State of Bacon',
    'A State of Vine', 'Super Size Me', 'Super Size Me 2: Holy Chicken!', 'Terminal Bar|2002',
    'Unacceptable Levels', 'Wine for the Confused',
  ],
  'Documentary films / Vegetarianism': [
    'Devour the Earth', 'Earthlings', 'Fat, Sick and Nearly Dead', 'Food Matters', 'Forks Over Knives',
    'Go Further', 'Meet Your Meat', 'Peaceable Kingdom', 'Planeat', 'A Sacred Duty', 'Vegucated',
  ],
  'Soft drinks': [
    "Bosko's Soda Fountain", 'The Coca-Cola Kid', 'The Cola Conquest', 'The Gods Must Be Crazy',
    'One, Two, Three',
  ],
  Coffee: ['Barista', 'Black Coffee|2007', 'Black Gold|2006', 'Café. Waiting. Love', 'Christmas in July'],
  Beer: [
    'American Beer', 'Beer Wars', 'Beerfest', 'Un bon bock', 'Cheer Boys Cheer', 'Drinking Buddies',
    'The Fight with the Dragon', 'The Frankenstein Brothers', 'Krazy Kat Invalid',
    'Monks, Girls and Hungarian Soldiers', 'Old Man Drinking a Glass of Beer', 'Schwechater',
    'Smokey and the Bandit', 'Song of the Eagle', 'Take This Job and Shove It', 'What! No Beer?',
    "The World's End",
  ],
  Wine: [
    'At Sachem Farm', 'Autumn Tale', 'Back to Burgundy', 'Barolo Boys', 'The Birth of Saké',
    'Blood into Wine', 'Bottle Shock', 'The Enchanted Drawing', 'Eye of the Devil', 'Fine Gold',
    'German Wine', 'A Good Year', 'Laughing Heirs', 'A Man About the House', 'Mondovino',
    'Les Raisins de la Mort', 'Red Obsession', 'Saint-Amour', 'The Secret of Santa Vittoria',
    'Sideways|2004', 'Sideways|2009', 'Somm', 'Somm 3', 'Somm: Into the Bottle', 'Sour Grapes|2016',
    'A State of Vine', 'Story of Wine', 'Terroir', 'This Earth Is Mine|1959', 'Uncorked|2009',
    'Uncorked|2020', 'Vagabond|1985', 'The Vineyard', 'A Walk in the Clouds', 'Wine Country',
    'Wine for the Confused', 'The Winemaker of Langenlois', 'Year of the Comet',
  ],
  Restaurants: [
    'Al Dente', "Betty Boop's Bizzy Bee", 'Big Night', 'The Big Restaurant', "The Bob's Burgers Movie",
    "Bosko's Soda Fountain", 'Bread of Happiness', 'Burnt', 'Cafe Isobe', 'Chef|2014', 'The Chef|2012',
    'Choke', 'Clerks II', 'Cocktail', 'La colmena', 'Combination Platter', 'Compliance',
    'The Cook, the Thief, His Wife & Her Lover', 'Diner', 'The Dinner', 'Dinner Rush', 'Double Patty',
    'East Side Sushi', 'The Encounter', 'Estômago', 'Extreme Job', 'The Founder',
    'Give Me a Book of Complaints', 'The God of Ramen', 'Good Burger', 'Gravy', 'Hash House Blues',
    'A Hound for Trouble', 'The Hundred-Foot Journey', "I'm Livin' It", 'Iamhere', 'Izakaya Chōji',
    'Jiro Dreams of Sushi', 'Kamome Shokudo', 'The Kitchen in Paris',
    "Krazy Kat & Ignatz Mouse Discuss the Letter 'G'", 'Lights in the Dusk', 'Little Italy|2018',
    "Love's Kitchen", 'Maska|2020', 'Melvin Goes to Dinner', 'The Menu|2022', 'Monsieur Albert',
    'Mostly Martha', 'My Dinner with Andre', 'Mystic Pizza', 'No Reservations', 'The Other Side of Hope',
    'Perfect Sense', 'The Petrified Forest', "Porky's Last Stand", 'The Princess and the Frog',
    'Ratatouille', 'The Secret of the Grain', 'Service for Ladies|1927', 'Service for Ladies|1932',
    "The Slammin' Salmon", 'Soul Kitchen', 'Spin|2021', 'Still Waiting...', 'Summer in Tyrol',
    'Super Size Me', 'Super Size Me 2: Holy Chicken!', 'Tampopo', "Today's Special", 'Trip for Tat',
    'Vienna Tales', 'Waiter!', 'Waiting...', 'West Bank Story', "When You Comin' Back, Red Ryder?",
    'The White Horse Inn|1926', 'The White Horse Inn|1935', 'The White Horse Inn|1952',
    'The White Horse Inn|1960',
  ],
  'Confectionery/Desserts': [
    'The Cakemaker', 'Charlie and the Chocolate Factory', 'Chocolat|2000', 'Hoodwinked!',
    'Hoodwinked Too! Hood vs. Evil', 'Hop|2011', 'Kings of Pastry', 'Lessons in Chocolate',
    'Merci pour le Chocolat', 'Patisserie Coin de rue', 'Tom and Jerry: Willy Wonka and the Chocolate Factory',
    'Willy Wonka & the Chocolate Factory', 'Wonka|2023',
  ],
  Miscellaneous: [
    "The Angels' Share", 'Aqua Teen Hunger Force Colon Movie Film for Theaters',
    'The Attack of the Giant Moussaka', 'Attack of the Killer Tomatoes', 'Basmati Blues',
    'Cloudy with a Chance of Meatballs', 'Cloudy with a Chance of Meatballs 2', 'Criminally Insane',
    'Criminally Insane 2', 'Fast Food Nation', 'Feast|2014', 'Foodfight!', 'Foodiverse',
    'Un gallo con muchos huevos', 'Killer Tomatoes Eat France!', 'Killer Tomatoes Strike Back!',
    'The Nuttiest Nutcracker', 'Otra Película de Huevos y un Pollo', 'Over the Hedge',
    'Una Película de Huevos', 'Un rescate de huevitos', 'Return of the Killer Tomatoes!', 'Sausage Party',
    'The Scarecrow|2013', 'Soylent Green', 'Strange Brew', 'Whisky Galore!|1949', 'White Lightning|1973',
  ],
  'Feature films about cooking': [
    "Babette's Feast", 'Barbie: A Fairy Secret', 'Barbie: A Fashion Fairytale', 'Big Night',
    'The Big Restaurant', 'Burnt', 'Chef|2014', 'The Chef|2012', 'The Chinese Feast', 'Chocolat|2000',
    'The Cook, the Thief, His Wife & Her Lover', 'Cook Up a Storm', 'Cooking with Stella', 'Dinner Rush',
    'Eat Drink Man Woman', "Eddie's Million Dollar Cook-Off", 'Estômago', 'The God of Cookery',
    'Le Grand Chef', 'Le Grand Chef 2: Kimchi Battle', 'La Grande Bouffe', 'Gulabjaam|2018',
    'Ham and Eggs', 'Haute Cuisine', 'The Hundred-Foot Journey', 'Jiro Dreams of Sushi', 'Julie & Julia',
    'Just Desserts', 'Kings of Pastry', "Krazy Kat & Ignatz Mouse Discuss the Letter 'G'",
    'Kung Fu Chefs', 'Like Water for Chocolate', 'Mostly Martha', 'My Breakfast with Blassie',
    'My Dinner with Andre', 'No Reservations', 'Now, Forager', 'Osaka Wrestling Restaurant',
    'Pieces of April', 'The Platform', 'The Princess and the Frog', 'The Ramen Girl', 'Ratatouille',
    'Salaam Namaste', 'Simply Irresistible', "The Slammin' Salmon", 'Soul Food', 'Soul Kitchen',
    'Sweet Bean', 'Tampopo', "Today's Special", 'Tortilla Soup', 'A Touch of Spice',
    'Tsukiji Uogashi Sandaime', 'Vatel', 'Waitress|2007', 'Who Is Killing the Great Chefs of Europe?',
    'The Wing or the Thigh', 'Woman on Top',
  ],
};

// Films TMDB files under a different title than Wikipedia uses (translated/alternate titles, or a more
// famous namesake that wins the title search). Each was checked by hand against TMDB's synopsis.
// Key = the list entry ("Title" or "Title|year"); id = the TMDB film; query = what to search if not the title.
const PINS = {
  'Dive!': { id: 82642, query: "Dive! Living off America's waste" }, // 2010 dumpster-diving documentary
  'A Matter of Taste': { id: 82259, query: 'A Matter of Taste: Serving Up Paul Liebrandt' }, // 2011 chef documentary
  Ingredients: { id: 83653 }, // 2009 local-food documentary (not the 2020 drama)
  'Waiter!': { id: 75996, query: 'Waiter' }, // 1983 French "Garçon!"
  'La colmena': { id: 104435 }, // 1982 "The Beehive", set in a Madrid café
  'The Chef|2012': { id: 85872, query: 'Comme un chef' }, // 2012 "Le Chef" with Jean Reno
  'Barolo Boys': { id: 297784 }, // "Barolo Boys: The Story of a Revolution"
  'Les Raisins de la Mort': { id: 29107 }, // "The Grapes of Death"
  'Somm 3': { id: 549321 }, // "Somm III"
  Estômago: { id: 69335 }, // "Estômago: A Gastronomic Story"
  'Kamome Shokudo': { id: 25657 }, // "Kamome Diner"
  'The Attack of the Giant Moussaka': { id: 47856 }, // spelled "Mousaka" on TMDB
  'Otra Película de Huevos y un Pollo': { id: 37221 }, // "Another Egg and Chicken Movie"
  'Una Película de Huevos': { id: 16761 }, // "A Movie of Eggs"
  'Un rescate de huevitos': { id: 573164 }, // "An Egg Rescue"
  'Un gallo con muchos huevos': { id: 264419 }, // "Huevos: Little Rooster's Egg-Cellent Adventure"
  'Tsukiji Uogashi Sandaime': { id: 229114 }, // "The Taste of Fish"
  'Merci pour le Chocolat': { id: 10305 }, // English title "Nightcap"
  'Izakaya Chōji': { id: 254148 }, // "Choji Snack Bar"
  'Un bon bock': { id: 16622 }, // 1892 Reynaud short, "A Good Beer"
  'At Sachem Farm': { id: 24224 }, // alternate title "Higher Love"
  'The Frankenstein Brothers': { id: 142121 }, // "A Beer Tale"
  'Old Man Drinking a Glass of Beer': { id: 195186 }, // filed as "Comic Face"
};

// Left out on purpose: several unrelated TMDB films share the title and nothing says which one the page means.
const EXCLUDE = {
  Terroir: 'five different films called Terroir (2012, 2014, 2020, 2023, 2025); the page does not say which',
  'Al Dente': 'four unrelated films called Al Dente (a Finnish western short, an animated ogre horror, ...)',
};

// What the Wikipedia page itself reports per section; a typo in the lists above trips this check.
const EXPECTED_COUNTS = {
  'Documentary films': 41, 'Documentary films / Vegetarianism': 11, 'Soft drinks': 5, Coffee: 5, Beer: 17,
  Wine: 38, Restaurants: 80, 'Confectionery/Desserts': 13, Miscellaneous: 28,
  'Feature films about cooking': 59,
};

// ---------------------------------------------------------------------------------------------
// Category rules: copied from src/utils/specDraftGenreMapper.ts (mapGenresToCategories) so a movie
// gets exactly the categories the admin "add movie" button would give it.
// ---------------------------------------------------------------------------------------------
const TMDB_GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama',
  10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery',
  10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

function genreIdsFromString(genreString) {
  const lower = (genreString || '').toLowerCase();
  return Object.entries(TMDB_GENRE_MAP)
    .filter(([, name]) => lower.includes(name.toLowerCase()))
    .map(([id]) => parseInt(id, 10));
}

function mapGenresToCategories(genreString, year, oscarStatus, revenue, hasOscar, isBlockbuster, isSequel) {
  const g = (genreString || '').toLowerCase();
  const cats = [];
  if (g.includes('action') || g.includes('adventure')) cats.push('Action/Adventure');
  if (g.includes('animation') || g.includes('animated')) cats.push('Animated');
  if (g.includes('comedy')) cats.push('Comedy');
  if (g.includes('drama') || g.includes('romance')) cats.push('Drama/Romance');
  if (g.includes('sci-fi') || g.includes('science fiction') || g.includes('fantasy') || g.includes('science')) {
    cats.push('Sci-Fi/Fantasy');
  }
  if (g.includes('horror') || g.includes('thriller')) cats.push('Horror/Thriller');
  if (g.includes('documentary')) cats.push('Documentary');
  if (year) {
    if (year >= 1930 && year <= 1939) cats.push("30's");
    else if (year >= 1940 && year <= 1949) cats.push("40's");
    else if (year >= 1950 && year <= 1959) cats.push("50's");
    else if (year >= 1960 && year <= 1969) cats.push("60's");
    else if (year >= 1970 && year <= 1979) cats.push("70's");
    else if (year >= 1980 && year <= 1989) cats.push("80's");
    else if (year >= 1990 && year <= 1999) cats.push("90's");
    else if (year >= 2000 && year <= 2009) cats.push("2000's");
    else if (year >= 2010 && year <= 2019) cats.push("2010's");
    else if (year >= 2020 && year <= 2029) cats.push("2020's");
  }
  if (hasOscar === true || oscarStatus === 'winner' || oscarStatus === 'nominee') {
    cats.push('Academy Award Nominee or Winner');
  }
  if (isBlockbuster === true || (revenue && revenue >= 50000000)) cats.push('Blockbuster (minimum of $50 Mil)');
  if (isSequel === true) cats.push('Sequel');
  return [...new Set(cats)];
}

// ---------------------------------------------------------------------------------------------
// Supabase (public anon key, read-only calls)
// ---------------------------------------------------------------------------------------------
const clientSource = fs.readFileSync(path.resolve('src/integrations/supabase/client.ts'), 'utf8');
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || clientSource.match(/"(https:\/\/[a-z0-9]+\.supabase\.co)"/)?.[1];
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || clientSource.match(/"(eyJ[A-Za-z0-9._-]+)"/)?.[1];
if (!SUPABASE_URL || !ANON_KEY) throw new Error('Could not read the Supabase URL / anon key from src/integrations/supabase/client.ts');

const authHeaders = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' };

async function searchTmdb(title) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-movies`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ category: 'search', searchQuery: title, fetchAll: false, page: 1 }),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data?.results || []).map((m) => ({
        id: m.id ?? m.tmdbId,
        title: m.title,
        year: m.year ?? (m.releaseDate ? parseInt(String(m.releaseDate).slice(0, 4), 10) : null),
        posterPath: m.posterPath || null,
        genre: typeof m.genre === 'string' ? m.genre : '',
        description: typeof m.description === 'string' ? m.description : null,
        oscarStatus: m.oscar_status || null,
        hasOscar: m.hasOscar === true,
        revenue: m.revenue || 0,
        isBlockbuster: m.isBlockbuster === true,
        isSequel: m.isSequel === true,
        voteAverage: m.voteAverage ?? null,
      }));
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return [];
}

async function existingSpecDrafts() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/spec_drafts?select=name,slug,display_order,is_hidden`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`Could not read spec_drafts: HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------
function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(the|a|an) /, '');
}

function buildFilmList() {
  const byKey = new Map();
  for (const [section, entries] of Object.entries(SECTIONS)) {
    if (entries.length !== EXPECTED_COUNTS[section]) {
      throw new Error(`Section "${section}" has ${entries.length} entries, the page reports ${EXPECTED_COUNTS[section]}`);
    }
    for (const entry of entries) {
      const [title, yearStr] = entry.split('|');
      const year = yearStr ? parseInt(yearStr, 10) : null;
      const key = `${norm(title)}|${year ?? ''}`;
      if (!byKey.has(key)) byKey.set(key, { title, year, sections: [] });
      byKey.get(key).sections.push(section);
    }
  }
  return [...byKey.values()].map((f) => ({ ...f, restaurant: f.sections.includes('Restaurants') }));
}

const pinKey = (film) => (film.year ? `${film.title}|${film.year}` : film.title);

function pickMatch(film, results) {
  const pin = PINS[pinKey(film)];
  if (pin) {
    const hit = results.find((r) => r.id === pin.id);
    return hit ? { status: 'pinned', pick: hit, others: [] } : { status: 'none', pick: null, others: results.slice(0, 3) };
  }
  if (EXCLUDE[film.title]) return { status: 'excluded', pick: null, others: results.slice(0, 5), reason: EXCLUDE[film.title] };

  const exact = results.filter((r) => norm(r.title) === norm(film.title));
  // With a year hint, allow a year off by one but prefer the closest year (stable, so TMDB's order breaks ties).
  const candidates = film.year
    ? exact
        .filter((r) => r.year && Math.abs(r.year - film.year) <= 1)
        .sort((a, b) => Math.abs(a.year - film.year) - Math.abs(b.year - film.year))
    : exact;
  if (candidates.length === 1) return { status: 'ok', pick: candidates[0], others: [] };
  if (candidates.length > 1) {
    // More than one TMDB film with this exact title: take TMDB's first (its relevance order) but flag it.
    return { status: film.year ? 'ok' : 'multi', pick: candidates[0], others: candidates.slice(1, 5) };
  }
  return { status: 'none', pick: null, others: results.slice(0, 3) };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next;
        next += 1;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

// ---------------------------------------------------------------------------------------------
// SQL output
// ---------------------------------------------------------------------------------------------
const q = (s) => (s == null || s === '' ? 'NULL' : `'${String(s).replace(/\u0000/g, '').replace(/'/g, "''")}'`);
const n = (v) => (v == null || Number.isNaN(v) ? 'NULL' : String(Math.round(v)));

function buildSql(rows, existing) {
  const slugLit = q(SPEC_DRAFT_SLUG);
  const movieValues = rows
    .map((r) => {
      const m = r.match;
      const genres = genreIdsFromString(m.genre);
      return `(${m.id}, ${q(m.title)}, ${n(m.year || null)}, ${q(m.posterPath)}, '{${genres.join(',')}}', ${q(
        m.description && m.description !== 'No description available' ? m.description.trim() : null
      )}, ${q(m.oscarStatus)}, ${n(m.revenue)}, ${m.isSequel ? 'true' : 'false'})`;
    })
    .join(',\n    ');

  const categoryRows = [];
  for (const r of rows) {
    const m = r.match;
    const auto = mapGenresToCategories(m.genre, m.year, m.oscarStatus, m.revenue, m.hasOscar, m.isBlockbuster, m.isSequel);
    for (const c of auto) categoryRows.push(`(${m.id}, ${q(c)}, true)`);
    if (r.restaurant) categoryRows.push(`(${m.id}, ${q(CUSTOM_CATEGORY)}, false)`);
  }

  const dupNote = existing.some((d) => d.slug === SPEC_DRAFT_SLUG)
    ? `-- NOTE: a spec draft with slug "${SPEC_DRAFT_SLUG}" already exists; this script will ADD to it.\n`
    : '';

  return `-- "${SPEC_DRAFT_NAME}" spec draft, built from Wikipedia's "List of films about food and drink".
-- ${rows.length} films, custom category "${CUSTOM_CATEGORY}" (${rows.filter((r) => r.restaurant).length} films from the page's Restaurants section).
-- Generated by create-food-and-drink-spec-draft.js. Safe to run twice (everything is ON CONFLICT DO NOTHING).
-- Paste into the Supabase SQL editor and run.
${dupNote}
BEGIN;

-- 1. The spec draft itself (goes last in the display order, like the admin "create" button)
INSERT INTO public.spec_drafts (name, slug, description, display_order)
VALUES (${q(SPEC_DRAFT_NAME)}, ${slugLit}, ${q(SPEC_DRAFT_DESCRIPTION)},
        (SELECT COALESCE(MAX(display_order), 0) + 1 FROM public.spec_drafts))
ON CONFLICT (slug) DO NOTHING;

-- 2. The custom category
INSERT INTO public.spec_draft_categories (spec_draft_id, category_name)
SELECT id, ${q(CUSTOM_CATEGORY)} FROM public.spec_drafts WHERE slug = ${slugLit}
ON CONFLICT (spec_draft_id, category_name) DO NOTHING;

-- 3. The movies
INSERT INTO public.spec_draft_movies
  (spec_draft_id, movie_tmdb_id, movie_title, movie_year, movie_poster_path, movie_genres, movie_overview,
   oscar_status, revenue, is_sequel, sequel_enriched_at)
SELECT sd.id, v.tmdb_id::integer, v.title, v.year::integer, v.poster, v.genres::integer[], v.overview,
       v.oscar, v.revenue::bigint, v.is_sequel::boolean, now()
FROM public.spec_drafts sd
CROSS JOIN (VALUES
    ${movieValues}
) AS v(tmdb_id, title, year, poster, genres, overview, oscar, revenue, is_sequel)
WHERE sd.slug = ${slugLit}
ON CONFLICT (spec_draft_id, movie_tmdb_id) DO NOTHING;

-- 4. Which categories each movie can be drafted in (standard ones as the admin auto-detects them, plus "${CUSTOM_CATEGORY}")
INSERT INTO public.spec_draft_movie_categories (spec_draft_movie_id, category_name, is_automated)
SELECT m.id, v.category_name::text, v.is_automated::boolean
FROM (VALUES
    ${categoryRows.join(',\n    ')}
) AS v(tmdb_id, category_name, is_automated)
JOIN public.spec_drafts sd ON sd.slug = ${slugLit}
JOIN public.spec_draft_movies m ON m.spec_draft_id = sd.id AND m.movie_tmdb_id = v.tmdb_id::integer
ON CONFLICT (spec_draft_movie_id, category_name) DO NOTHING;

COMMIT;

-- Check: should show ${rows.length} movies and ${rows.filter((r) => r.restaurant).length} in ${CUSTOM_CATEGORY}.
SELECT
  (SELECT count(*) FROM public.spec_draft_movies m JOIN public.spec_drafts sd ON sd.id = m.spec_draft_id WHERE sd.slug = ${slugLit}) AS movies,
  (SELECT count(*) FROM public.spec_draft_movie_categories c
     JOIN public.spec_draft_movies m ON m.id = c.spec_draft_movie_id
     JOIN public.spec_drafts sd ON sd.id = m.spec_draft_id
   WHERE sd.slug = ${slugLit} AND c.category_name = ${q(CUSTOM_CATEGORY)}) AS in_${CUSTOM_CATEGORY.toLowerCase()};
`;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
async function main() {
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    /* no cache yet */
  }

  let films = buildFilmList();
  console.log(`${Object.values(SECTIONS).flat().length} list entries -> ${films.length} distinct films`);

  const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (only.length) films = films.filter((f) => only.some((o) => norm(o) === norm(f.title)));

  let done = 0;
  const looked = await pool(films, 4, async (film) => {
    const query = PINS[pinKey(film)]?.query || film.title;
    const key = query;
    if (!cache[key]) cache[key] = await searchTmdb(query);
    done += 1;
    if (done % 25 === 0) {
      console.log(`  looked up ${done}/${films.length}`);
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    }
    return { film, ...pickMatch(film, cache[key]) };
  });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

  // The same TMDB film reached from two list entries (e.g. a wrong match) is only added once.
  const byTmdb = new Map();
  const collisions = [];
  for (const r of looked) {
    if (!r.pick) continue;
    const prev = byTmdb.get(r.pick.id);
    if (prev) {
      prev.restaurant = prev.restaurant || r.film.restaurant;
      collisions.push(`"${r.film.title}" and "${prev.film.title}" both resolved to TMDB ${r.pick.id} (${r.pick.title})`);
    } else {
      byTmdb.set(r.pick.id, { film: r.film, match: r.pick, restaurant: r.film.restaurant, status: r.status, others: r.others });
    }
  }
  const rows = [...byTmdb.values()];

  // ----- review report -----
  const fmt = (m) => `${m.title} (${m.year ?? '?'}) [tmdb ${m.id}]`;
  const multi = looked.filter((r) => r.status === 'multi');
  const none = looked.filter((r) => r.status === 'none');
  const excluded = looked.filter((r) => r.status === 'excluded');
  const lines = [];
  lines.push(`# Food and Drink Movies: lookup review`, '');
  lines.push(`- Distinct films from the page: ${films.length}`);
  lines.push(`- Matched: ${rows.length}  (exact: ${looked.filter((r) => r.status === 'ok').length}, pinned by hand: ${looked.filter((r) => r.status === 'pinned').length}, same-title namesakes exist: ${multi.length})`);
  lines.push(`- Left out on purpose: ${excluded.length}`);
  lines.push(`- Not on TMDB / no confident match: ${none.length}`);
  lines.push(`- Tagged Restaurants: ${rows.filter((r) => r.restaurant).length}`, '');
  if (collisions.length) lines.push('## Two list entries -> one TMDB film', ...collisions.map((c) => `- ${c}`), '');
  lines.push('## Several TMDB films share this exact title (first one picked, please check)', '');
  for (const r of multi) {
    lines.push(`- **${r.film.title}** -> picked ${fmt(r.pick)}; others: ${r.others.map(fmt).join('; ') || 'none'}`);
    lines.push(`  - picked synopsis: ${(r.pick.description || '').slice(0, 160)}`);
  }
  lines.push('', '## Left out on purpose (not in the SQL)', '');
  for (const r of excluded) lines.push(`- **${r.film.title}**: ${r.reason}`);
  lines.push('', '## No confident match (not in the SQL)', '');
  for (const r of none) {
    lines.push(`- **${r.film.title}**${r.film.year ? ` (${r.film.year})` : ''}: top TMDB results: ${r.others.map(fmt).join('; ') || 'nothing'}`);
  }
  lines.push('', '## Everything matched', '', '| List title | TMDB title | Year | TMDB id | Restaurants | Status |', '|---|---|---|---|---|---|');
  for (const r of rows.sort((a, b) => a.film.title.localeCompare(b.film.title))) {
    lines.push(`| ${r.film.title} | ${r.match.title} | ${r.match.year ?? ''} | ${r.match.id} | ${r.restaurant ? 'yes' : ''} | ${r.status} |`);
  }
  fs.writeFileSync(REPORT_FILE, lines.join('\n'));

  if (only.length) {
    console.log('\nONLY mode, nothing written except the report/cache.');
    for (const r of looked) console.log(`${r.film.title}: ${r.status} -> ${r.pick ? fmt(r.pick) : 'no match'}`);
    return;
  }

  const existing = await existingSpecDrafts();
  console.log(`\nExisting spec drafts on the project: ${existing.length}; slug "${SPEC_DRAFT_SLUG}" taken: ${existing.some((d) => d.slug === SPEC_DRAFT_SLUG)}`);

  fs.writeFileSync(SQL_OUT, buildSql(rows, existing));
  console.log(`\nWrote ${SQL_OUT}`);
  console.log(`Wrote ${REPORT_FILE}`);
  console.log(`Matched ${rows.length}/${films.length}; exact ${looked.filter((r) => r.status === 'ok').length}; pinned ${looked.filter((r) => r.status === 'pinned').length}; namesakes ${multi.length}; left out ${excluded.length}; not on TMDB ${none.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
