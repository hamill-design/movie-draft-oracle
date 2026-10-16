import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://zduruulowyopdstihfwk.supabase.co';

// Try to use service role key first (for admin operations, bypasses RLS), fallback to anon key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabaseKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const SPEC_DRAFT_NAME = 'Stop Motion Movies';
const SPEC_DRAFT_SLUG = 'stop-motion-movies';
const SPEC_DRAFT_DESCRIPTION = 'Stop-motion animated features, from El Apóstol (1917) through 2025 — puppet, clay, cutout and mixed technique.';

// Source: Wikipedia "List of stop-motion films" (Released section). Country column dropped —
// not part of the spec_draft schema — but title/year/technique are kept for TMDB lookup + categorization.
// A handful of unreleased/upcoming titles (e.g. Wildwood, Shaun the Sheep: The Beast of Mossy Bottom)
// are intentionally omitted since they won't resolve in TMDB search yet.
const movies = [
  { title: 'El Apóstol', year: 1917, technique: 'Cutout' },
  { title: 'The Adventures of Prince Achmed', year: 1926, technique: 'Cutout' },
  { title: 'Ein Rückblick in die Urwelt', year: 1927, technique: 'Cutout' },
  { title: 'The Tale of the Fox', year: 1937, technique: 'Puppet' },
  { title: 'The Seven Ravens', year: 1937, technique: 'Puppet' },
  { title: 'Handling Ships', year: 1945, technique: 'Puppet' },
  { title: 'The Crab with the Golden Claws', year: 1947, technique: 'Puppet' },
  { title: 'The Czech Year AKA A Treasury of Fairy-tales', year: 1947, technique: 'Puppet' },
  { title: 'The Emperor\'s Nightingale', year: 1949, technique: 'Puppet' },
  { title: 'Adventures of Esparadrapo', year: 1949, technique: 'Puppet' },
  { title: 'Prince Bayaya', year: 1950, technique: 'Puppet' },
  { title: 'The Treasure of Bird Island', year: 1952, technique: 'Puppet' },
  { title: 'Old Czech Legends', year: 1953, technique: 'Puppet' },
  { title: 'Hansel and Gretel: An Opera Fantasy', year: 1954, technique: 'Puppet' },
  { title: 'The Good Soldier Schweik', year: 1955, technique: 'Puppet' },
  { title: 'The Heavenly Creation (Nebesnoe sozdanie)', year: 1956, technique: 'Puppet' },
  { title: 'Beloved Beauty', year: 1958, technique: 'Puppet' },
  { title: 'A Midsummer Night\'s Dream', year: 1959, technique: 'Puppet' },
  { title: 'The Strange Story of the Inhabitants of Schiltburg', year: 1961, technique: 'Puppet' },
  { title: 'Heaven and Earth Magic', year: 1962, technique: 'Cutout' },
  { title: 'Joseph The Dreamer', year: 1962, technique: 'Puppet' },
  { title: 'The Peacock Princess', year: 1963, technique: 'Puppet' },
  { title: 'The Girl With Long Hair', year: 1964, technique: 'Puppet' },
  { title: 'Lefty', year: 1964, technique: 'Cutout' },
  { title: 'Willy McBean and his Magic Machine', year: 1965, technique: 'Puppet' },
  { title: 'Go There, Don\'t Know Where', year: 1966, technique: 'Cutout' },
  { title: 'Taro, the Son Of Dragon', year: 1966, technique: 'Puppet' },
  { title: 'Ballad of Smokey the Bear', year: 1966, technique: 'Puppet' },
  { title: 'Heungbuwa Nolbu', year: 1967, technique: 'Puppet' },
  { title: 'Mad Monster Party?', year: 1967, technique: 'Puppet' },
  { title: 'The Kurohime Story', year: 1967, technique: 'Puppet' },
  { title: 'The Mighty Taro', year: 1968, technique: 'Puppet' },
  { title: 'Adam', year: 1968, technique: 'Cutout' },
  { title: 'Hanako, The Elephant', year: 1969, technique: 'Puppet' },
  { title: 'Dougal and the Blue Cat', year: 1970, technique: 'Puppet' },
  { title: 'Here Comes Peter Cottontail', year: 1971, technique: 'Puppet' },
  { title: 'The Enchanted World of Danny Kaye: The Emperor\'s New Clothes', year: 1972, technique: 'Puppet' },
  { title: 'Fantastic Planet', year: 1973, technique: 'Cutout' },
  { title: 'The Year Without a Santa Claus', year: 1974, technique: 'Puppet' },
  { title: 'Adventures of Sinbad the Sailor', year: 1974, technique: 'Cutout' },
  { title: 'The Pinchcliffe Grand Prix', year: 1975, technique: 'Puppet' },
  { title: 'Rudolph\'s Shiny New Year', year: 1976, technique: 'Puppet' },
  { title: 'The Easter Bunny Is Comin\' To Town', year: 1977, technique: 'Puppet' },
  { title: 'The Holiday of Disobedience', year: 1977, technique: 'Puppet' },
  { title: 'The Scrap and the Cloud', year: 1977, technique: 'Cutout' },
  { title: 'Kongjui & Patchui', year: 1978, technique: 'Puppet' },
  { title: 'Krabat – The Sorcerer\'s Apprentice', year: 1978, technique: 'Cutout' },
  { title: 'La pobre viejecita', year: 1978, technique: 'Puppet' },
  { title: 'Colargol, the Conqueror of Space', year: 1979, technique: 'Puppet' },
  { title: 'Jack Frost', year: 1979, technique: 'Puppet' },
  { title: 'Nutcracker Fantasy', year: 1979, technique: 'Puppet' },
  { title: 'Ubu et la Grande Gidouille', year: 1979, technique: 'Cutout' },
  { title: 'Rudolph and Frosty\'s Christmas in July', year: 1979, technique: 'Puppet' },
  { title: 'Colargol and the Magic Suitcase', year: 1980, technique: 'Puppet' },
  { title: 'I Go Pogo', year: 1980, technique: 'Puppet' },
  { title: 'Pinocchio\'s Christmas', year: 1980, technique: 'Puppet' },
  { title: 'The Tale Of John and Marie', year: 1980, technique: 'Cutout' },
  { title: 'Rennyo and His Mother', year: 1981, technique: 'Puppet' },
  { title: 'Adventures of Robinson Crusoe, a Sailor from York', year: 1982, technique: 'Puppet' },
  { title: 'Henry The Horse', year: 1982, technique: 'Cutout' },
  { title: 'The Flying Windmill', year: 1982, technique: 'Puppet' },
  { title: 'Our House', year: 1982, technique: 'Cutout' },
  { title: 'Chronopolis', year: 1982, technique: 'Puppet' },
  { title: 'The Adventures of Sam the Squirrel', year: 1982, technique: 'Puppet' },
  { title: 'The Wind in the Willows', year: 1983, technique: 'Puppet' },
  { title: 'Cristóbal Colón', year: 1983, technique: 'Puppet' },
  { title: 'The Little Witch', year: 1983, technique: 'Cutout' },
  { title: 'Twice Upon a Time', year: 1983, technique: 'Cutout' },
  { title: 'Saving Mother', year: 1984, technique: 'Puppet' },
  { title: 'The Adventures of Mark Twain AKA Comet Quest', year: 1985, technique: 'Clay' },
  { title: 'The Life & Adventures of Santa Claus', year: 1985, technique: 'Puppet' },
  { title: 'Odyssea', year: 1985, technique: 'Cutout' },
  { title: 'The Pied Piper of Hamelin', year: 1986, technique: 'Puppet' },
  { title: 'Sophie\'s Place', year: 1986, technique: 'Cutout' },
  { title: 'The Amazing Mr. Bickford', year: 1987, technique: 'Clay' },
  { title: 'Long live Servatius!', year: 1987, technique: 'Puppet' },
  { title: 'My Favourite Time', year: 1987, technique: 'Cutout' },
  { title: 'The Puppetoon Movie', year: 1987, technique: 'Puppet' },
  { title: 'Papobo', year: 1987, technique: 'Puppet' },
  { title: 'The Cat Who Walked by Herself', year: 1988, technique: 'Mixed' },
  { title: 'Santa Claus: The Baker Street', year: 1989, technique: 'Cutout' },
  { title: 'A Tale of Two Toads', year: 1989, technique: 'Puppet' },
  { title: 'The Trace Leads to the Silver Lake', year: 1990, technique: 'Puppet' },
  { title: 'The Fool of the World and the Flying Ship', year: 1990, technique: 'Puppet' },
  { title: 'The School of Fine Arts', year: 1990, technique: 'Mixed' },
  { title: 'The School of Fine Arts: The Return', year: 1990, technique: 'Mixed' },
  { title: 'Mitki-Mayer', year: 1992, technique: 'Cutout' },
  { title: 'The Nightmare Before Christmas', year: 1993, technique: 'Puppet' },
  { title: 'The Return of Captain Sinbad', year: 1993, technique: 'Puppet' },
  { title: 'The Secret Adventures of Tom Thumb', year: 1993, technique: 'Puppet & Pixilation' },
  { title: 'Gumby: The Movie', year: 1995, technique: 'Clay' },
  { title: 'James and the Giant Peach', year: 1996, technique: 'Puppet' },
  { title: 'Kings and Cabbage', year: 1996, technique: 'Cutout' },
  { title: 'The Ballad of the Viking King, Holger the Dane', year: 1996, technique: 'Puppet' },
  { title: 'Jue jiang de Kailaban', year: 1997, technique: 'Puppet' },
  { title: 'Mamo, czy kury potrafią mówić?', year: 1997, technique: 'Puppet' },
  { title: 'Reise um die Erde in 80 Tagen', year: 1998, technique: 'Puppet' },
  { title: 'The Magic Pipe', year: 1998, technique: 'Puppet' },
  { title: 'The Miracle Maker', year: 2000, technique: 'Puppet' },
  { title: 'Chicken Run', year: 2000, technique: 'Clay' },
  { title: 'Prop and Berta', year: 2000, technique: 'Puppet' },
  { title: 'Optimus Mundus', year: 2000, technique: 'Mixed' },
  { title: 'Tootletubs & Jyro', year: 2001, technique: 'Puppet' },
  { title: 'Bob the Builder: A Christmas to Remember', year: 2001, technique: 'Puppet' },
  { title: 'Fimfárum Jana Wericha', year: 2002, technique: 'Puppet' },
  { title: 'Winter Days', year: 2003, technique: 'Puppet' },
  { title: 'The Legend of the Sky Kingdom', year: 2003, technique: 'Puppet' },
  { title: 'Bob the Builder: The Knights of Can-A-Lot', year: 2003, technique: 'Puppet' },
  { title: 'Davey and Goliath\'s Snowboard Christmas', year: 2004, technique: 'Clay' },
  { title: 'Bob the Builder: Snowed Under', year: 2004, technique: 'Puppet' },
  { title: 'Bob the Builder: When Bob Became a Builder', year: 2004, technique: 'Puppet' },
  { title: 'Disaster!', year: 2005, technique: 'Puppet' },
  { title: 'Klay World: Off the Table', year: 2005, technique: 'Clay' },
  { title: 'Among the Thorns', year: 2005, technique: 'Cutout' },
  { title: 'The Book of the Dead', year: 2005, technique: 'Puppet' },
  { title: 'Corpse Bride', year: 2005, technique: 'Puppet' },
  { title: 'Wallace & Gromit: The Curse of the Were-Rabbit', year: 2005, technique: 'Clay' },
  { title: 'The Three Musketeers', year: 2005, technique: 'Puppet' },
  { title: 'Bob the Builder: Bob\'s Big Plan', year: 2005, technique: 'Puppet' },
  { title: 'Live Freaky! Die Freaky!', year: 2006, technique: 'Puppet' },
  { title: 'Blood Tea and Red String', year: 2006, technique: 'Puppet' },
  { title: 'Fimfárum 2', year: 2006, technique: 'Puppet' },
  { title: 'Holidaze: The Christmas That Almost Didn\'t Happen', year: 2006, technique: 'Clay' },
  { title: 'Desmond & the Swamp Barbarian Trap', year: 2006, technique: 'Puppet' },
  { title: 'Bob the Builder: Built to be Wild', year: 2006, technique: 'Puppet' },
  { title: 'Saving Mother', year: 2006, technique: 'Puppet' },
  { title: 'We Are the Strange', year: 2007, technique: 'Puppet' },
  { title: 'One Night in One City', year: 2007, technique: 'Puppet' },
  { title: 'Max & Co', year: 2007, technique: 'Puppet' },
  { title: 'Tengers', year: 2007, technique: 'Clay' },
  { title: 'Davie & Golimyr', year: 2008, technique: 'Puppet' },
  { title: '$9.99', year: 2008, technique: 'Puppet' },
  { title: 'Moomin and Midsummer Madness', year: 2008, technique: 'Puppet' },
  { title: 'Edison and Leo', year: 2008, technique: 'Puppet' },
  { title: 'A Miser Brothers\' Christmas', year: 2008, technique: 'Puppet' },
  { title: 'Bob the Builder: Race to the Finish', year: 2008, technique: 'Puppet' },
  { title: 'Coraline', year: 2009, technique: 'Puppet' },
  { title: 'Mary and Max', year: 2009, technique: 'Puppet' },
  { title: 'A Town Called Panic', year: 2009, technique: 'Puppet' },
  { title: 'Fantastic Mr. Fox', year: 2009, technique: 'Puppet' },
  { title: 'Toys in the Attic', year: 2009, technique: 'Puppet' },
  { title: 'Sky Song', year: 2010, technique: 'Puppet' },
  { title: 'The Ugly Duckling', year: 2010, technique: 'Puppet' },
  { title: 'Jackboots on Whitehall', year: 2010, technique: 'Puppet' },
  { title: 'Cheburashka', year: 2010, technique: 'Puppet' },
  { title: 'Moomins and the Comet Chase', year: 2010, technique: 'Puppet' },
  { title: 'The Puppet Monster Massacre', year: 2010, technique: 'Puppet' },
  { title: 'The Sandman and the Lost Sand of Dreams', year: 2010, technique: 'Puppet' },
  { title: 'Fimfarum: The Third Time Lucky', year: 2011, technique: 'Puppet' },
  { title: 'Spot and Splodge on the Spot', year: 2011, technique: 'Puppet' },
  { title: 'The Pirates! In an Adventure with Scientists!', year: 2012, technique: 'Clay' },
  { title: 'ParaNorman', year: 2012, technique: 'Puppet' },
  { title: 'The Apostle', year: 2012, technique: 'Puppet' },
  { title: 'Consuming Spirits', year: 2012, technique: 'Cutout' },
  { title: 'Frankenweenie', year: 2012, technique: 'Puppet' },
  { title: '7 Sea Pirates', year: 2012, technique: 'Puppet' },
  { title: 'Miffy the Movie', year: 2013, technique: 'Puppet' },
  { title: 'Lisa Limone and Maroc Orange: A Rapid Love Story', year: 2013, technique: 'Puppet' },
  { title: 'Louis & Luca and the Snow Machine', year: 2013, technique: 'Puppet' },
  { title: 'Worms', year: 2013, technique: 'Puppet' },
  { title: 'Spot and Spldogde Plottspotting', year: 2013, technique: 'Puppet' },
  { title: 'The Boxtrolls', year: 2014, technique: 'Puppet' },
  { title: 'Possessed', year: 2014, technique: 'Clay' },
  { title: 'Shaun the Sheep Movie', year: 2015, technique: 'Clay' },
  { title: 'El Bandido Cucaracha', year: 2015, technique: 'Puppet' },
  { title: 'Little from the Fish Shop', year: 2015, technique: 'Puppet' },
  { title: 'Acid Space', year: 2015, technique: 'Puppet' },
  { title: 'Hell and Back', year: 2015, technique: 'Puppet' },
  { title: 'Louis and Luca – The Big Cheese Race', year: 2015, technique: 'Puppet' },
  { title: 'Anomalisa', year: 2015, technique: 'Puppet' },
  { title: 'Kuru Kuru and Friends: The Rainbow Tree Forest', year: 2015, technique: 'Puppet' },
  { title: 'The Hunting of the Snark', year: 2015, technique: 'Puppet' },
  { title: 'Les espiègles', year: 2016, technique: 'Puppet' },
  { title: 'Pat a Mat ve filmu', year: 2016, technique: 'Puppet' },
  { title: 'Finding Santa', year: 2016, technique: 'Puppet' },
  { title: 'Murderous Tales', year: 2016, technique: 'Puppet' },
  { title: 'Kubo and the Two Strings', year: 2016, technique: 'Puppet' },
  { title: 'My Life as a Courgette', year: 2016, technique: 'Clay' },
  { title: 'In the Forest of Huckybucky', year: 2016, technique: 'Puppet' },
  { title: 'Moomins and the Winter Wonderland', year: 2017, technique: 'Puppet' },
  { title: 'Junk Head', year: 2017, technique: 'Puppet' },
  { title: 'Laika', year: 2017, technique: 'Puppet' },
  { title: 'The Tower', year: 2018, technique: 'Puppet' },
  { title: 'Pat & Mat Back in Action', year: 2018, technique: 'Puppet' },
  { title: 'Early Man', year: 2018, technique: 'Clay' },
  { title: 'Chuck Steel: Night of the Trampires', year: 2018, technique: 'Puppet' },
  { title: 'This Magnificent Cake!', year: 2018, technique: 'Puppet' },
  { title: 'Isle of Dogs', year: 2018, technique: 'Puppet' },
  { title: 'Pat & Mat: Winter Fun', year: 2018, technique: 'Puppet' },
  { title: 'Strike', year: 2018, technique: 'Puppet' },
  { title: 'Captain Morten and the Spider Queen', year: 2018, technique: 'Puppet' },
  { title: 'Gofmaniada', year: 2018, technique: 'Puppet' },
  { title: 'The Wolf House', year: 2018, technique: 'Puppet' },
  { title: 'Louis & Luca - Mission to the Moon', year: 2018, technique: 'Puppet' },
  { title: 'Urpo ja Turpo johtolangan jäljillä', year: 2018, technique: 'Puppet' },
  { title: 'Missing Link', year: 2019, technique: 'Puppet' },
  { title: 'Pat & Mat: DIY Troubles', year: 2019, technique: 'Puppet' },
  { title: 'The Old Man', year: 2019, technique: 'Puppet' },
  { title: 'A Shaun the Sheep Movie: Farmageddon', year: 2019, technique: 'Clay' },
  { title: 'A Colourful Dream', year: 2020, technique: 'Puppet' },
  { title: 'The Nose or the Conspiracy of Mavericks', year: 2020, technique: 'Cutout' },
  { title: 'L\'équipe de secours, en route pour l\'aventure!', year: 2020, technique: 'Puppet' },
  { title: 'Alien Xmas', year: 2020, technique: 'Puppet' },
  { title: 'Mad God', year: 2021, technique: 'Puppet' },
  { title: 'Bob Spit: We Do Not Like People', year: 2021, technique: 'Puppet' },
  { title: 'Even Mice Belong in Heaven', year: 2021, technique: 'Puppet' },
  { title: 'Adventures of a young Moomin', year: 2021, technique: 'Puppet' },
  { title: 'Pat & Mat: Baking and Grilling!', year: 2021, technique: 'Puppet' },
  { title: 'The House', year: 2022, technique: 'Puppet' },
  { title: 'Knor', year: 2022, technique: 'Puppet' },
  { title: 'Wendell & Wild', year: 2022, technique: 'Puppet' },
  { title: 'Guillermo del Toro\'s Pinocchio', year: 2022, technique: 'Puppet' },
  { title: 'No Dogs or Italians Allowed', year: 2022, technique: 'Puppet' },
  { title: 'The Inventor', year: 2023, technique: 'Puppet' },
  { title: 'Chicken Run: Dawn of the Nugget', year: 2023, technique: 'Clay' },
  { title: 'My Grandfather\'s Demons', year: 2023, technique: 'Puppet' },
  { title: 'Tony, Shelly and the Magic Light', year: 2023, technique: 'Puppet' },
  { title: 'Memoir of a Snail', year: 2024, technique: 'Puppet' },
  { title: 'Living Large', year: 2024, technique: 'Puppet' },
  { title: 'Savages', year: 2024, technique: 'Puppet' },
  { title: 'Wallace & Gromit: Vengeance Most Fowl', year: 2024, technique: 'Clay' },
  { title: 'I Am Frankelda', year: 2025, technique: 'Puppet' },
  { title: 'Junk World', year: 2025, technique: 'Puppet' },
  { title: 'Saurus City', year: 2025, technique: 'Puppet' },
  { title: 'Olivia and the Invisible Earthquake', year: 2025, technique: 'Puppet' },
  { title: 'Tales from the Magic Garden', year: 2025, technique: 'Puppet' },
  { title: 'Memory Hotel', year: 2025, technique: 'Puppet' },
];

// Techniques become custom categories on the spec draft (not part of the standard category set)
const ALL_TECHNIQUES = [...new Set(movies.map(m => m.technique))].sort();

function decadeCategory(year) {
  if (!year) return null;
  const decade = Math.floor(year / 10) * 10;
  if (decade < 1930) return null; // no bucket for pre-1930s in the standard category list
  if (decade >= 2000) return `${decade}'s`;
  return `${decade % 100}'s`;
}

// fetch-movies search results return genre as a space-separated string (e.g. "Animation Family"),
// not a `genres`/`genre_ids` array — this maps it to TMDB genre IDs for the movie_genres column.
const TMDB_GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

function genreIdsFromString(genreString) {
  const lower = (genreString || '').toLowerCase();
  return Object.entries(TMDB_GENRE_MAP)
    .filter(([, name]) => lower.includes(name.toLowerCase()))
    .map(([id]) => parseInt(id, 10));
}

// Every title in this list is a stop-motion animated feature, so Animated always applies —
// independent of whatever genre tags TMDB itself carries (some, e.g. documentaries, omit it).
function categoriesFromGenreString(genreString) {
  const g = (genreString || '').toLowerCase();
  const cats = ['Animated'];
  if (g.includes('action') || g.includes('adventure')) cats.push('Action/Adventure');
  if (g.includes('comedy')) cats.push('Comedy');
  if (g.includes('drama') || g.includes('romance')) cats.push('Drama/Romance');
  if (g.includes('sci-fi') || g.includes('science fiction') || g.includes('fantasy')) cats.push('Sci-Fi/Fantasy');
  if (g.includes('horror') || g.includes('thriller')) cats.push('Horror/Thriller');
  return cats;
}

async function searchMovie(title, year) {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-movies', {
      body: {
        category: 'search',
        searchQuery: title,
        fetchAll: false,
        page: 1,
      },
    });

    if (error) {
      console.error(`Error searching for "${title}":`, error);
      return null;
    }

    const results = data?.results || [];

    let bestMatch = results.find(m => {
      const resultYear = m.year || (m.release_date ? parseInt(m.release_date.split('-')[0]) : null);
      return m.title === title && resultYear === year;
    });

    // Allow the release year to be off by one (region/festival release date quirks)
    if (!bestMatch) {
      bestMatch = results.find(m => {
        const resultYear = m.year || (m.release_date ? parseInt(m.release_date.split('-')[0]) : null);
        return m.title === title && resultYear && Math.abs(resultYear - year) <= 1;
      });
    }

    if (!bestMatch && results.length > 0) {
      bestMatch = results[0];
      console.log(`  using first result for "${title}" (${year}): "${bestMatch.title}" (${bestMatch.year || 'unknown year'})`);
    }

    return bestMatch || null;
  } catch (err) {
    console.error(`Exception searching for "${title}":`, err);
    return null;
  }
}

async function ensureSpecDraft() {
  const { data: existing, error: fetchError } = await supabase
    .from('spec_drafts')
    .select('*')
    .eq('slug', SPEC_DRAFT_SLUG)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    console.log(`Using existing spec draft "${existing.name}" (ID: ${existing.id})`);
    return existing.id;
  }

  const { data: created, error: createError } = await supabase
    .from('spec_drafts')
    .insert({
      name: SPEC_DRAFT_NAME,
      slug: SPEC_DRAFT_SLUG,
      description: SPEC_DRAFT_DESCRIPTION,
    })
    .select()
    .single();

  if (createError) throw createError;

  console.log(`Created spec draft "${created.name}" (ID: ${created.id})`);
  return created.id;
}

async function ensureCustomCategories(specDraftId) {
  for (const technique of ALL_TECHNIQUES) {
    const { error } = await supabase
      .from('spec_draft_categories')
      .insert({
        spec_draft_id: specDraftId,
        category_name: technique,
        description: null,
      });

    if (error) {
      if (error.code === '23505') {
        console.log(`  custom category "${technique}" already exists`);
      } else {
        console.error(`  error creating custom category "${technique}":`, error.message);
      }
    } else {
      console.log(`  created custom category "${technique}"`);
    }
  }
}

async function addMovie(specDraftId, sourceMovie, tmdbMovie) {
  const categories = [sourceMovie.technique, ...categoriesFromGenreString(tmdbMovie.genre)];
  const decade = decadeCategory(sourceMovie.year);
  if (decade) categories.push(decade);

  const { data: existing } = await supabase
    .from('spec_draft_movies')
    .select('id')
    .eq('spec_draft_id', specDraftId)
    .eq('movie_tmdb_id', tmdbMovie.id)
    .maybeSingle();

  let specDraftMovieId;

  if (existing) {
    specDraftMovieId = existing.id;
    console.log(`  ${tmdbMovie.title} already in draft, refreshing categories`);
    await supabase
      .from('spec_draft_movie_categories')
      .delete()
      .eq('spec_draft_movie_id', specDraftMovieId);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('spec_draft_movies')
      .insert({
        spec_draft_id: specDraftId,
        movie_tmdb_id: tmdbMovie.id,
        movie_title: tmdbMovie.title,
        movie_year: tmdbMovie.year || sourceMovie.year || null,
        movie_poster_path: tmdbMovie.posterPath || tmdbMovie.poster_path || null,
        movie_genres: genreIdsFromString(tmdbMovie.genre),
        movie_overview: typeof tmdbMovie.description === 'string' ? tmdbMovie.description : null,
        oscar_status: tmdbMovie.oscar_status || tmdbMovie.oscarStatus || null,
        revenue: tmdbMovie.revenue || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    specDraftMovieId = inserted.id;
  }

  const categoriesToInsert = categories.map(categoryName => ({
    spec_draft_movie_id: specDraftMovieId,
    category_name: categoryName,
    is_automated: false,
  }));

  const { error: categoriesError } = await supabase
    .from('spec_draft_movie_categories')
    .insert(categoriesToInsert);

  if (categoriesError) {
    console.error('  error adding categories:', categoriesError.message);
  }
}

async function main() {
  console.log('Creating "Stop Motion Movies" spec draft...\n');

  if (SUPABASE_SERVICE_KEY) {
    console.log('Using service role key (admin access enabled)\n');
  } else {
    console.log('Using anon key - writes require an authenticated session; set SUPABASE_SERVICE_KEY to bypass RLS.\n');
  }

  const specDraftId = await ensureSpecDraft();

  console.log(`\nEnsuring ${ALL_TECHNIQUES.length} technique categories: ${ALL_TECHNIQUES.join(', ')}`);
  await ensureCustomCategories(specDraftId);

  console.log(`\nProcessing ${movies.length} movies...\n`);

  let successCount = 0;
  let failCount = 0;
  const failedMovies = [];

  for (const movie of movies) {
    console.log(`Searching: "${movie.title}" (${movie.year}) [${movie.technique}]`);
    const tmdbMovie = await searchMovie(movie.title, movie.year);

    if (tmdbMovie) {
      try {
        await addMovie(specDraftId, movie, tmdbMovie);
        console.log(`  added: "${tmdbMovie.title}" (${tmdbMovie.year || 'unknown year'})`);
        successCount++;
      } catch (err) {
        console.error(`  failed to add "${movie.title}":`, err.message);
        failCount++;
        failedMovies.push({ ...movie, error: err.message });
      }
    } else {
      console.log(`  not found in TMDB`);
      failCount++;
      failedMovies.push({ ...movie, error: 'Not found in TMDB' });
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total movies: ${movies.length}`);
  console.log(`Added/updated: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  if (failedMovies.length > 0) {
    console.log('\nFailed movies (add these manually via the admin UI):');
    failedMovies.forEach(m => console.log(`  - "${m.title}" (${m.year}): ${m.error}`));
  }

  console.log(`\nSpec draft ID: ${specDraftId}`);
  console.log(`Slug: ${SPEC_DRAFT_SLUG}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
