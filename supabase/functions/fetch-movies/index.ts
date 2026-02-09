// Deno global types
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore - Deno HTTP imports are resolved at runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno ESM imports are resolved at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting for OMDb API calls
let omdbCallsToday = 0;
const OMDB_DAILY_LIMIT = 900; // Stay under 1000 limit
let lastResetDate = new Date().toDateString();

// Initialize Supabase client for oscar_cache
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Academy Award JSON: first source for Oscar status (tmdb_id -> "winner" | "nominee"). Loaded once per cold start from ACADEMY_AWARDS_JSON_URL.
let _academyAwardsMap: Map<number, string> | null = null;
async function getAcademyAwardsMap(): Promise<Map<number, string>> {
  if (_academyAwardsMap) return _academyAwardsMap;
  _academyAwardsMap = new Map();
  const jsonUrl = Deno.env.get('ACADEMY_AWARDS_JSON_URL');
  if (!jsonUrl || jsonUrl.trim() === '') {
    console.log('Academy awards JSON URL not set (ACADEMY_AWARDS_JSON_URL); skipping');
    return _academyAwardsMap;
  }
  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      console.log('Academy awards JSON fetch failed:', response.status, response.statusText);
      return _academyAwardsMap;
    }
    const content = await response.text();
    const data = JSON.parse(content);
    // Handle array of award entries: [{ category, year, movies: [{ tmdb_id, ... }], won: boolean }, ...]
    if (Array.isArray(data)) {
      for (const entry of data) {
        if (entry.movies && Array.isArray(entry.movies)) {
          const status = entry.won === true ? 'winner' : 'nominee';
          for (const movie of entry.movies) {
            if (movie.tmdb_id != null) {
              // If movie already in map (multiple nominations), prefer "winner" over "nominee"
              const existing = _academyAwardsMap!.get(Number(movie.tmdb_id));
              if (!existing || existing === 'nominee') {
                _academyAwardsMap!.set(Number(movie.tmdb_id), status);
              }
            }
          }
        }
      }
      console.log(`Academy awards JSON loaded: ${_academyAwardsMap.size} movies`);
    } else if (data.movies && Array.isArray(data.movies)) {
      // Fallback: handle old format { movies: [{ tmdb_id, status }, ...] }
      for (const m of data.movies) {
        if (m.tmdb_id != null && m.status) _academyAwardsMap!.set(Number(m.tmdb_id), m.status);
      }
      console.log(`Academy awards JSON loaded (old format): ${_academyAwardsMap.size} movies`);
    }
  } catch (e) {
    console.log('Academy awards JSON not loaded:', e);
  }
  if (_academyAwardsMap.size === 0) {
    console.log('Academy Awards map is empty; set ACADEMY_AWARDS_JSON_URL for correct Oscar counts');
  }
  return _academyAwardsMap;
}

// Helper function to get person lifespan data by TMDB ID with auto-population from TMDB API
async function getPersonLifespan(tmdbId: number): Promise<{birth_date: string | null, death_date: string | null} | null> {
  try {
    // First try by TMDB ID (most reliable)
    const { data } = await supabase
      .from('person_lifespans')
      .select('birth_date, death_date, name')
      .eq('tmdb_id', tmdbId)
      .single();
    
    if (data) {
      console.log(`✅ Found lifespan by TMDB ID ${tmdbId}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
      return data;
    }
  } catch (error) {
    console.log(`🔍 TMDB ID ${tmdbId} not found in lifespans, fetching from TMDB API...`);
    
    // Auto-populate missing lifespan data from TMDB API
    try {
      const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
      if (!tmdbApiKey) {
        console.log('❌ TMDB API key not configured, cannot fetch lifespan data');
        return null;
      }
      
      const tmdbResponse = await fetch(`https://api.themoviedb.org/3/person/${tmdbId}?api_key=${tmdbApiKey}`);
      
      if (!tmdbResponse.ok) {
        console.log(`❌ TMDB API error for person ${tmdbId}: ${tmdbResponse.status}`);
        return null;
      }
      
      const personData = await tmdbResponse.json();
      console.log(`📦 Fetched person data from TMDB: ${personData.name} (${personData.birthday} - ${personData.deathday})`);
      
      // Extract and format dates
      const birthDate = personData.birthday || null;
      const deathDate = personData.deathday || null;
      const personName = personData.name || `Person ${tmdbId}`;
      
      // Cache the lifespan data in our database
      const { data: cachedData, error: cacheError } = await supabase
        .from('person_lifespans')
        .upsert({
          tmdb_id: tmdbId,
          name: personName,
          birth_date: birthDate,
          death_date: deathDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('birth_date, death_date, name')
        .single();
      
      if (cacheError) {
        console.log(`❌ Failed to cache lifespan data for ${personName}: ${cacheError.message}`);
        // Return the data anyway, even if caching failed
        return { birth_date: birthDate, death_date: deathDate };
      }
      
      console.log(`✅ Cached and returning lifespan data for ${personName}: (${birthDate} - ${deathDate})`);
      return cachedData;
      
    } catch (apiError) {
      console.log(`❌ Failed to fetch person data from TMDB API: ${apiError}`);
      return null;
    }
  }
  
  return null;
}

// Helper function to get person lifespan data by name with enhanced matching
async function getPersonLifespanByName(personName: string): Promise<{birth_date: string | null, death_date: string | null} | null> {
  console.log(`🔍 Looking up lifespan by name for: "${personName}"`);
  
  // First try exact match
  let { data, error } = await supabase
    .from('person_lifespans')  
    .select('birth_date, death_date, name, tmdb_id')
    .eq('name', personName)
    .single();
    
  if (!error && data) {
    console.log(`✅ Found exact match for ${personName}: ${data.birth_date} - ${data.death_date}`);
    return data;
  }
  
  // Try case-insensitive match
  ({ data, error } = await supabase
    .from('person_lifespans')  
    .select('birth_date, death_date, name, tmdb_id')
    .ilike('name', personName)
    .single());
    
  if (!error && data) {
    console.log(`✅ Found case-insensitive match for ${personName}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
    return data;
  }
  
  // Try alias lookup
  const { data: aliasData, error: aliasError } = await supabase
    .from('actor_name_aliases')
    .select('primary_name, tmdb_id')
    .eq('alias_name', personName)
    .single();
    
  if (!aliasError && aliasData) {
    console.log(`🔄 Found alias: "${personName}" -> "${aliasData.primary_name}"`);
    
    // Get lifespan data using TMDB ID from alias
    ({ data, error } = await supabase
      .from('person_lifespans')  
      .select('birth_date, death_date, name, tmdb_id')
      .eq('tmdb_id', aliasData.tmdb_id)
      .single());
      
    if (!error && data) {
      console.log(`✅ Found lifespan via alias for ${personName}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
      return data;
    }
  }
  
  // Try partial name matching (last resort)
  const nameParts = personName.split(' ');
  if (nameParts.length >= 2) {
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts[0];
    
    ({ data, error } = await supabase
      .from('person_lifespans')  
      .select('birth_date, death_date, name, tmdb_id')
      .ilike('name', `${firstName}%${lastName}%`)
      .single());
      
    if (!error && data) {
      console.log(`✅ Found partial match for ${personName}: "${data.name}" (${data.birth_date} - ${data.death_date})`);
      return data;
    }
  }
  
  console.log(`💭 ${personName} is not in our deceased actors database (assumed living)`);
  return null;
}

// Enhanced function to detect documentaries and archive footage - now used universally
function isDocumentaryOrArchiveContent(movie: any, movieGenres: any[]): boolean {
  // Check genre IDs - expanded documentary detection
  if (movieGenres && Array.isArray(movieGenres)) {
    const documentaryGenreIds = [99, 10770]; // Documentary, TV Movie
    const hasDocumentaryGenre = movieGenres.some(genre => 
      genre && documentaryGenreIds.includes(genre.id)
    );
    if (hasDocumentaryGenre) {
      console.log(`Documentary detected via genre: ${movieGenres.map(g => g.name || g.id).join(', ')}`);
      return true;
    }
  }

  // Check title keywords for documentary/compilation/tribute content
  const title = (movie.title || '').toLowerCase();
  const documentaryKeywords = [
    // Documentary keywords
    'documentary', 'making of', 'behind the scenes', 'retrospective',
    // Tribute/memorial keywords  
    'tribute', 'tribute to', 'legacy', 'remembering', 'in memoriam', 
    'celebrating', 'honoring', 'remembers',
    // Compilation/collection keywords
    'archives', 'footage', 'collection', 'compilation', 'best of',
    'greatest hits', 'selected works', 'complete works', 'anthology',
    'highlights', 'moments', 'scenes from', 'clips'
  ];
  
  const hasDocumentaryKeywords = documentaryKeywords.some(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(title);
  });
  if (hasDocumentaryKeywords) {
    console.log(`Archive content detected via title keywords: "${title}"`);
    return true;
  }

  // Check overview for archive footage indicators
  const overview = (movie.overview || '').toLowerCase();
  const archiveKeywords = [
    'archive footage', 'archival footage', 'rare footage', 'unseen footage',
    'behind the scenes', 'documentary about', 'tribute to'
  ];
  
  const hasArchiveKeywords = archiveKeywords.some(keyword => overview.includes(keyword));
  if (hasArchiveKeywords) {
    console.log(`Archive content detected via overview: "${overview.substring(0, 100)}..."`);
    return true;
  }

  return false;
}

// Enhanced function to check character roles for archive footage
function isArchiveFootageRole(movie: any, actorName: string): boolean {
  // Check if character name indicates archive footage
  const character = (movie.character || '').toLowerCase();
  const archiveRoles = ['self', 'archive footage', 'himself', 'herself', 'narrator', 'host'];
  
  if (archiveRoles.some(role => character.includes(role))) {
    console.log(`Archive role detected: "${movie.character}" in "${movie.title}"`);
    return true;
  }

  return false;
}

// Enhanced function to filter out TV content and validate movie eligibility
function isValidMovieContent(movie: any): boolean {
  if (!movie) return false;
  
  // Check for TV-specific indicators
  if (movie.media_type === 'tv') {
    console.log(`🚫 TV content filtered: "${movie.title || movie.name}" (media_type: tv)`);
    return false;
  }
  
  // Check for TV Movie genre (10770) and other TV-specific genres
  const tvGenreIds = [10770, 10762]; // TV Movie, TV News
  if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
    const hasTvGenre = movie.genre_ids.some((id: number) => tvGenreIds.includes(id));
    if (hasTvGenre) {
      console.log(`🚫 TV genre filtered: "${movie.title}" (genre IDs: ${movie.genre_ids.join(', ')})`);
      return false;
    }
  }
  
  // Check title patterns for TV episodes and specials
  const title = (movie.title || movie.name || '').toLowerCase();
  const tvTitlePatterns = [
    /episode \d+/i,
    /season \d+/i,
    /(^|\s)tv(\s|$)/i,
    /television/i,
    /mini-series/i,
    /miniseries/i,
    /web series/i,
    /tv special/i,
    /tv movie/i
  ];
  
  const isTvTitle = tvTitlePatterns.some(pattern => pattern.test(title));
  if (isTvTitle) {
    console.log(`🚫 TV title pattern filtered: "${movie.title}"`);
    return false;
  }
  
  // Check overview for TV indicators
  const overview = (movie.overview || '').toLowerCase();
  const tvOverviewKeywords = [
    'television series',
    'tv series', 
    'mini-series',
    'web series',
    'tv special',
    'television special'
  ];
  
  const hasTvOverview = tvOverviewKeywords.some(keyword => overview.includes(keyword));
  if (hasTvOverview) {
    console.log(`🚫 TV overview filtered: "${movie.title}" (overview contains TV keywords)`);
    return false;
  }
  
  // Universal documentary/compilation/tribute filtering (applies to all actors)
  // Create mock genres array for checking
  const mockGenres = movie.genre_ids ? movie.genre_ids.map((id: number) => ({ id })) : [];
  if (isDocumentaryOrArchiveContent(movie, mockGenres)) {
    console.log(`🚫 Documentary/tribute/compilation filtered: "${movie.title}"`);
    return false;
  }
  
  return true;
}

// Simplified function to validate movies for deceased actors
function isValidMovieForDeceasedActor(movie: any, deathDate: string, movieGenres: any[], actorName: string = ''): boolean {
  const death = new Date(deathDate);
  const deathYear = death.getFullYear();
  const movieYear = extractMovieYear(movie);
  
  if (movieYear === 0) {
    console.log(`Skipping movie with no valid year: "${movie.title}"`);
    return false;
  }

  // Simple cutoff: death year + 1 (e.g., died 1982 → only movies 1983 and earlier)
  const cutoffYear = deathYear + 1;
  
  if (movieYear > cutoffYear) {
    console.log(`🚫 Movie "${movie.title}" (${movieYear}) after death year cutoff (death: ${deathYear}, cutoff: ${cutoffYear})`);
    return false;
  }

  console.log(`✅ Valid movie for ${actorName}: "${movie.title}" (${movieYear}) within death year cutoff`);
  return true;
}

// Helper to fetch IMDb ID from TMDB external IDs
async function getImdbIdForMovie(tmdbId: number, tmdbApiKey: string): Promise<string | null> {
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${tmdbApiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('external_ids request failed');
    const json = await res.json();
    if (json?.imdb_id) return json.imdb_id;
  } catch {}
  // Fallback via movie details
  try {
    const det = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbApiKey}`);
    if (det.ok) {
      const j = await det.json();
      if (j?.imdb_id) return j.imdb_id;
    }
  } catch {}
  return null;
}

// Helper function to check and get Oscar status from cache or OMDb
async function getOscarStatus(tmdbId: number, title: string, year: number, imdbId?: string | null, originalTitle?: string | null): Promise<string> {
  try {
    // Reset daily counter if needed
    const today = new Date().toDateString();
    if (lastResetDate !== today) {
      omdbCallsToday = 0;
      lastResetDate = today;
    }

    // First check cache
    // Prefer cache by tmdb_id + year
    const { data: cached } = await supabase
      .from('oscar_cache')
      .select('oscar_status, movie_year')
      .eq('tmdb_id', tmdbId)
      .eq('movie_year', year || null)
      .single();

    if (cached) {
      console.log(`Oscar cache hit for "${title}": ${cached.oscar_status}`);
      return cached.oscar_status;
    }

    // If no tmdb-year hit and imdbId present, check cache by imdb_id
    if (!cached && imdbId) {
      const { data: cachedByImdb } = await supabase
        .from('oscar_cache')
        .select('oscar_status, movie_year')
        .eq('imdb_id', imdbId)
        .single();
      if (cachedByImdb) {
        console.log(`Oscar cache hit by IMDb for "${title}": ${cachedByImdb.oscar_status}`);
        return cachedByImdb.oscar_status;
      }
    }

    // Check rate limit
    if (omdbCallsToday >= OMDB_DAILY_LIMIT) {
      console.log(`OMDb rate limit reached for today (${omdbCallsToday}/${OMDB_DAILY_LIMIT})`);
      return 'unknown';
    }

    // Call OMDb API
    const omdbApiKey = Deno.env.get('OMDB');
    if (!omdbApiKey) {
      console.log('OMDb API key not configured');
      return 'unknown';
    }

    let data: any = null;
    if (imdbId) {
      const urlById = `http://www.omdbapi.com/?apikey=${omdbApiKey}&i=${encodeURIComponent(imdbId)}`;
      console.log(`Calling OMDb by IMDb ID for "${title}":`, urlById);
      const response = await fetch(urlById);
      data = await response.json();
    }

    // Fallbacks when IMDb lookup missing or failed
    if (!data || data.Response !== 'True') {
      const tryTitleYear = async (t: string, y: number | null) => {
        const q = y ? `&y=${y}` : '';
        const u = `http://www.omdbapi.com/?apikey=${omdbApiKey}&t=${encodeURIComponent(t)}${q}`;
        const r = await fetch(u);
        return r.json();
      };

      // Title + exact year, then ±1 tolerance
      data = await tryTitleYear(title, year);
      if (!data || data.Response !== 'True') data = await tryTitleYear(title, year ? year - 1 : null);
      if (!data || data.Response !== 'True') data = await tryTitleYear(title, year ? year + 1 : null);

      // Try original title if provided
      if ((!data || data.Response !== 'True') && originalTitle) {
        data = await tryTitleYear(originalTitle, year);
        if (!data || data.Response !== 'True') data = await tryTitleYear(originalTitle, year ? year - 1 : null);
        if (!data || data.Response !== 'True') data = await tryTitleYear(originalTitle, year ? year + 1 : null);
      }

      // Fallback to title-only if still not found
      if (!data || data.Response !== 'True') {
        const urlByTitle = `http://www.omdbapi.com/?apikey=${omdbApiKey}&t=${encodeURIComponent(title)}`;
        console.log(`Calling OMDb by title only for "${title}":`, urlByTitle);
        const response3 = await fetch(urlByTitle);
        data = await response3.json();
      }
    }
    omdbCallsToday++;

    let oscarStatus = 'none';
    let awardsData = '';

    if (data.Response === 'True' && data.Awards) {
      awardsData = data.Awards;
      console.log(`OMDb awards for "${title}": ${awardsData}`);
      
      const awards = awardsData.toLowerCase();
      if (awards.includes('won') && (awards.includes('oscar') || awards.includes('academy award'))) {
        oscarStatus = 'winner';
      } else if (awards.includes('nominated') && (awards.includes('oscar') || awards.includes('academy award'))) {
        oscarStatus = 'nominee';
      }
    }

    // Cache the result
    await supabase.from('oscar_cache').upsert({
      tmdb_id: tmdbId,
      imdb_id: imdbId || null,
      movie_title: title,
      movie_year: year,
      oscar_status: oscarStatus,
      awards_data: awardsData,
      updated_at: new Date().toISOString()
    });

    console.log(`OMDb result for "${title}": ${oscarStatus}`);
    return oscarStatus;

  } catch (error) {
    console.error(`Error getting Oscar status for "${title}":`, error);
    return 'none';
  }
}

// Normalized resolver that returns one of: 'winner' | 'nominee' | 'none' | 'unknown'
async function resolveOscarStatus(tmdbId: number, title: string, year: number, tmdbApiKey: string, options: { preferFreshOscarStatus?: boolean } = {}): Promise<string> {
  try {
    // Try to get IMDb ID first for high-accuracy lookups
    const imdbId = await getImdbIdForMovie(tmdbId, tmdbApiKey);
    let originalTitle: string | null = null;
    try {
      const det = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbApiKey}`);
      if (det.ok) {
        const j = await det.json();
        originalTitle = j?.original_title || null;
      }
    } catch {}

    // For Academy fresh runs, bypass cache entirely to avoid stale negatives
    if (options.preferFreshOscarStatus && imdbId) {
      console.log(`PreferFresh: bypassing cache for ${title} (${year}) using IMDb ${imdbId}`);
      const fresh = await getOscarStatus(tmdbId, title, year, imdbId, originalTitle);
      if (fresh) return fresh;
    }

    // Prefer exact year match in cache
    const { data: cachedExact } = await supabase
      .from('oscar_cache')
      .select('oscar_status, updated_at')
      .eq('tmdb_id', tmdbId)
      .eq('movie_year', year || null)
      .single();

    if (cachedExact?.oscar_status) {
      const isNegative = cachedExact.oscar_status === 'none' || cachedExact.oscar_status === 'unknown';
      const updatedAt = cachedExact.updated_at ? new Date(cachedExact.updated_at).getTime() : 0;
      const isStale = !updatedAt || (Date.now() - updatedAt > 30 * 24 * 60 * 60 * 1000);
      if ((options.preferFreshOscarStatus && isNegative && imdbId) || (isNegative && isStale && imdbId)) {
        console.log(`Refreshing negative/stale cache (exact) via IMDb for ${title}`);
        const refreshed = await getOscarStatus(tmdbId, title, year, imdbId, originalTitle);
        if (refreshed === 'winner' || refreshed === 'nominee') return refreshed;
      }
      return cachedExact.oscar_status;
    }

    // Fallback: any cache for this tmdb_id regardless of year
    const { data: cachedAny } = await supabase
      .from('oscar_cache')
      .select('oscar_status, updated_at')
      .eq('tmdb_id', tmdbId)
      .limit(1)
      .single();

    if (cachedAny?.oscar_status) {
      const isNegative = cachedAny.oscar_status === 'none' || cachedAny.oscar_status === 'unknown';
      const updatedAt = cachedAny.updated_at ? new Date(cachedAny.updated_at).getTime() : 0;
      const isStale = !updatedAt || (Date.now() - updatedAt > 30 * 24 * 60 * 60 * 1000);
      if ((options.preferFreshOscarStatus && isNegative && imdbId) || (isNegative && isStale && imdbId)) {
        console.log(`Refreshing negative/stale cache (any) via IMDb for ${title}`);
        const refreshed = await getOscarStatus(tmdbId, title, year, imdbId, originalTitle);
        if (refreshed === 'winner' || refreshed === 'nominee') return refreshed;
      }
      return cachedAny.oscar_status;
    }

    // Last resort: fetch via OMDb parser helper
    const status = await getOscarStatus(tmdbId, title, year, imdbId || undefined, originalTitle);
    return status || 'unknown';
  } catch (e) {
    console.log('resolveOscarStatus error:', e);
    return 'unknown';
  }
}

// Enhanced year extraction with multiple date field support
function getYearFromDate(dateString: string): number {
  if (!dateString) return 0;
  
  // Handle various date formats: YYYY-MM-DD, YYYY, partial dates
  const dateStr = dateString.toString().trim();
  
  // Try full ISO date format first
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      if (year > 1900 && year <= new Date().getFullYear() + 5) {
        return year;
      }
    }
  } catch (e) {
    // Continue to regex parsing
  }
  
  // Try regex to extract year from various formats
  const yearMatch = dateStr.match(/(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year > 1900 && year <= new Date().getFullYear() + 5) {
      return year;
    }
  }
  
  return 0;
}

// Enhanced function to extract year from movie with multiple fallbacks
function extractMovieYear(movie: any): number {
  // Try multiple date fields in order of preference
  const dateFields = ['release_date', 'primary_release_date', 'first_air_date'];
  
  for (const field of dateFields) {
    if (movie[field]) {
      const year = getYearFromDate(movie[field]);
      if (year > 0) {
        return year;
      }
    }
  }
  
  // Try direct year field
  if (movie.year && movie.year > 1900) {
    return movie.year;
  }
  
  return 0;
}

// Enhanced function to validate if a movie matches the requested year
function movieMatchesYear(movie: any, requestedYear: number): boolean {
  if (!movie || !requestedYear) return false;
  
  const movieYear = extractMovieYear(movie);
  const matches = movieYear === requestedYear;
  
  if (!matches && Math.random() < 0.1) { // Log 10% of mismatches for debugging
    console.log(`Year mismatch: "${movie.title}" - extracted year: ${movieYear}, requested: ${requestedYear}, release_date: ${movie.release_date}`);
  }
  
  return matches;
}

// Flexible title matching helper - handles variations and partial matches
function matchesTitleSearch(movieTitle: string, searchQuery: string): boolean {
  if (!movieTitle || !searchQuery) return false;
  
  // Normalize both strings for comparison
  const normalize = (str: string): string => {
    return str
      .toLowerCase()
      .trim()
      // Normalize multiple spaces to single space
      .replace(/\s+/g, ' ')
      // Normalize different apostrophe types
      .replace(/[''']/g, "'")
      // Normalize different dash types
      .replace(/[–—]/g, '-')
      // Remove punctuation that might interfere
      .replace(/[.,!?:;]/g, '')
      // Remove other special characters but keep spaces
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };
  
  const normalizedTitle = normalize(movieTitle);
  const normalizedQuery = normalize(searchQuery);
  
  // First try simple includes (fast path for exact matches)
  if (normalizedTitle.includes(normalizedQuery)) {
    return true;
  }
  
  // Split query into words and check if all words appear in title
  const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0);
  if (queryWords.length === 0) return false;
  
  // Check if all query words appear in the title (in any order)
  const allWordsMatch = queryWords.every(word => {
    // For short words (1-2 chars), require exact word boundary match
    if (word.length <= 2) {
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      return wordRegex.test(normalizedTitle);
    }
    // For longer words, allow partial matches
    return normalizedTitle.includes(word);
  });
  
  return allWordsMatch;
}

// Enhanced person validation and selection
function selectBestPersonMatch(personResults: any[], searchQuery: string): any | null {
  if (!personResults || personResults.length === 0) {
    return null;
  }
  
  const query = searchQuery.toLowerCase().trim();
  
  // First, try exact name match
  for (const person of personResults) {
    if (person.name && person.name.toLowerCase() === query) {
      console.log(`Exact name match found: ${person.name} (ID: ${person.id})`);
      return person;
    }
  }
  
  // Then try partial name match with high popularity
  const partialMatches = personResults.filter(person => 
    person.name && person.name.toLowerCase().includes(query) && person.popularity > 5
  );
  
  if (partialMatches.length > 0) {
    // Sort by popularity and return the highest
    partialMatches.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    console.log(`Partial match with high popularity: ${partialMatches[0].name} (ID: ${partialMatches[0].id}, popularity: ${partialMatches[0].popularity})`);
    return partialMatches[0];
  }
  
  // Fallback to first result if it has reasonable popularity
  const firstResult = personResults[0];
  if (firstResult.popularity > 1) {
    console.log(`Using first result: ${firstResult.name} (ID: ${firstResult.id}, popularity: ${firstResult.popularity})`);
    return firstResult;
  }
  
  console.log(`No suitable person match found for: ${searchQuery}`);
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log raw request body for debugging
    const rawBody = await req.text();
    console.log('🔍 RAW REQUEST BODY (first 500 chars):', rawBody.substring(0, 500));
    
    // Parse the body
    let requestData;
    try {
      requestData = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON, trying req.json():', parseError);
      // Reset the request body stream by creating new request
      const clonedReq = req.clone();
      requestData = await clonedReq.json();
    }
    
    const { searchQuery, category, page = 1, fetchAll = false, preferFreshOscarStatus = false, movieSearchQuery } = requestData;
    const tmdbApiKey = Deno.env.get('TMDB');

    if (!tmdbApiKey) {
      throw new Error('TMDB API key not configured');
    }

    console.log('='.repeat(80));
    console.log('🎬 FETCH MOVIES REQUEST:', { category, searchQuery, movieSearchQuery, page, fetchAll });
    console.log('🔍 DEBUG - Raw values:');
    console.log('  category type:', typeof category, 'value:', category);
    console.log('  searchQuery type:', typeof searchQuery, 'value:', searchQuery);
    console.log('  movieSearchQuery type:', typeof movieSearchQuery, 'value:', movieSearchQuery);
    console.log('  movieSearchQuery truthy:', !!movieSearchQuery);
    console.log('  movieSearchQuery length:', movieSearchQuery?.length || 0);
    console.log('  Full requestData:', JSON.stringify(requestData, null, 2));
    console.log('='.repeat(80));

    let url = '';
    let baseUrl = '';
    let data: any;
    
    // Build different API endpoints based on category
    switch (category) {
      case 'popular':
        baseUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`;
        url = `${baseUrl}&page=${page}`;
        break;
      case 'search':
        baseUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
        url = `${baseUrl}&page=${page}`;
        break;
      case 'year':
        // For year category, searchQuery is the year, movieSearchQuery is the user's search term
        const year = searchQuery || new Date().getFullYear();
        console.log('Searching for movies from year:', year, 'with search term:', movieSearchQuery);
        
        // Validate year is a reasonable number
        const yearNum = parseInt(year.toString());
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 5) {
          console.error('Invalid year provided:', year);
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1,
            error: `Invalid year: ${year}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // If fetchAll=true, we want all movies for caching - use discover API and fetch all pages
        // If movieSearchQuery is provided AND fetchAll=false, use search API with year filter
        if (!fetchAll && movieSearchQuery && movieSearchQuery.trim().length >= 2) {
          const searchTerm = movieSearchQuery.trim();
          baseUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchTerm)}&year=${yearNum}`;
          url = `${baseUrl}&page=${page}`;
          console.log('🔍 Using SEARCH API with year filter:', {
            searchTerm,
            year: yearNum,
            page,
            url: url.replace(tmdbApiKey, 'API_KEY_HIDDEN')
          });
        } else {
          // No search query OR fetchAll=true - use discover API to get all movies for the year
          const startDate = `${yearNum}-01-01`;
          const endDate = `${yearNum}-12-31`;
          baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_year=${yearNum}&year=${yearNum}&release_date.gte=${startDate}&release_date.lte=${endDate}&sort_by=popularity.desc`;
          url = fetchAll ? `${baseUrl}&page=${page}` : `${baseUrl}&page=1`; // Fetch all pages if fetchAll=true
          console.log(`📋 Using DISCOVER API (${fetchAll ? 'fetchAll=true' : 'no search query'}):`, {
            year: yearNum,
            fetchAll,
            url: url.replace(tmdbApiKey, 'API_KEY_HIDDEN')
          });
        }
        break;
      case 'person':
        // Enhanced person search with comprehensive filmography retrieval
        const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
        console.log('Searching for person:', searchQuery);
        
        try {
          const personResponse = await fetch(personSearchUrl);
          if (!personResponse.ok) {
            throw new Error(`Person search failed: ${personResponse.status}`);
          }
          const personData = await personResponse.json();
          
          if (personData.results && personData.results.length > 0) {
            // Use enhanced person selection
            const selectedPerson = selectBestPersonMatch(personData.results, searchQuery);
            
            if (!selectedPerson) {
              console.log('No suitable person match found for query:', searchQuery);
              return new Response(JSON.stringify({
                results: [],
                total_pages: 0,
                total_results: 0,
                page: 1,
                reason: 'No suitable person match found'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            
            console.log('Selected person:', selectedPerson.name, 'ID:', selectedPerson.id, 'Popularity:', selectedPerson.popularity);
            
            // Use person's movie credits instead of discover endpoint for complete filmography
            // Also fetch credits when movieSearchQuery is provided (to search through all movies)
            if (fetchAll || movieSearchQuery) {
              console.log('Fetching complete filmography using person credits endpoint', { fetchAll, movieSearchQuery });
              const creditsUrl = `https://api.themoviedb.org/3/person/${selectedPerson.id}/movie_credits?api_key=${tmdbApiKey}`;
              
              try {
                const creditsResponse = await fetch(creditsUrl);
                if (!creditsResponse.ok) {
                  throw new Error(`Credits fetch failed: ${creditsResponse.status}`);
                }
                const creditsData = await creditsResponse.json();
                
                // Get person lifespan to determine filtering strategy
                let personLifespan = await getPersonLifespan(selectedPerson.id);
                
                // If TMDB ID lookup failed, try name-based lookup as fallback
                if (!personLifespan) {
                  console.log(`🔄 TMDB ID lookup failed for ${selectedPerson.name}, trying name-based lookup...`);
                  personLifespan = await getPersonLifespanByName(selectedPerson.name);
                }
                
                let allMovies: any[] = [];
                if (personLifespan && personLifespan.death_date) {
                  console.log(`${selectedPerson.name} is deceased (died: ${personLifespan.death_date}), filtering credits`);
                  // For deceased actors, only include cast credits (actual performances)
                  allMovies = (creditsData.cast || []).filter((movie: any) => {
                    // Apply TV content filtering first
                    if (!isValidMovieContent(movie)) {
                      return false;
                    }
                    
                    // Ensure we have a proper acting role (not just archive footage)
                    const character = (movie.character || '').toLowerCase();
                    const isActingRole = character && 
                      !character.includes('self') && 
                      !character.includes('archive footage') &&
                      !character.includes('narrator') &&
                      !character.includes('host');
                    
                    if (!isActingRole && character) {
                      console.log(`🚫 Non-acting role filtered: "${movie.title}" - character: "${movie.character}"`);
                      return false;
                    }
                    
                    return true;
                  });
                } else {
                  console.log(`${selectedPerson.name} is living or not in our database, including filtered credits`);
                  // For living actors, prioritize cast credits but include some crew roles
                  const castMovies = (creditsData.cast || []).filter(isValidMovieContent);
                  
                  // Only include crew if they're in key creative roles (director, producer, writer)
                  const keyCrewDepartments = ['Directing', 'Production', 'Writing'];
                  const crewMovies = (creditsData.crew || [])
                    .filter((movie: any) => keyCrewDepartments.includes(movie.department))
                    .filter(isValidMovieContent);
                  
                  allMovies = [...castMovies, ...crewMovies];
                  console.log(`Living actor credits: ${castMovies.length} cast + ${crewMovies.length} key crew = ${allMovies.length} total`);
                }
                
                // Remove duplicates based on movie ID and apply additional filtering
                let uniqueMovies: any[] = allMovies.filter((movie, index, self) => 
                  index === self.findIndex((m: any) => m.id === movie.id)
                );
                
                console.log(`After TV filtering and deduplication: ${uniqueMovies.length} unique movies`);
                
                // Enhanced lifespan filtering for deceased actors
                if (personLifespan && personLifespan.death_date) {
                  const originalCount = uniqueMovies.length;
                  console.log(`🔍 Applying enhanced filtering for deceased actor: ${selectedPerson.name} (died: ${personLifespan.death_date})`);
                  
                  uniqueMovies = uniqueMovies.filter((movie: any) => {
                    // Convert genre_ids to genre objects for consistency
                    const genres = (movie.genre_ids || []).map((id: number) => ({ id }));
                    return isValidMovieForDeceasedActor(movie, personLifespan.death_date!, genres, selectedPerson.name);
                  });
                  
                  const filteredCount = originalCount - uniqueMovies.length;
                  console.log(`📊 Enhanced lifespan filtering: ${originalCount} → ${uniqueMovies.length} movies`);
                  console.log(`🗑️  Filtered out ${filteredCount} posthumous/documentary/archive entries`);
                  
                  // Log some examples of what was filtered
                  if (filteredCount > 0) {
                    console.log(`🎬 Remaining valid movies sample: ${uniqueMovies.slice(0, 5).map(m => `"${m.title}" (${extractMovieYear(m)})`).join(', ')}`);
                  }
                }
                
                console.log(`Person credits: ${creditsData.cast?.length || 0} cast + ${creditsData.crew?.length || 0} crew = ${allMovies.length} total, ${uniqueMovies.length} unique movies`);
                
                // Filter by movieSearchQuery if provided AND not fetching all (for caching)
                // When fetchAll=true, we want all movies for caching, so skip this filter
                if (!fetchAll && movieSearchQuery && movieSearchQuery.trim().length >= 2) {
                  const searchTerm = movieSearchQuery.trim();
                  const originalCount = uniqueMovies.length;
                  
                  // Log sample of movies before filtering for debugging
                  console.log(`🔍 Searching for "${searchTerm}" in ${originalCount} movies`);
                  if (originalCount > 0 && originalCount <= 50) {
                    console.log(`📋 All movies before search filter:`, uniqueMovies.map(m => `"${m.title}" (${extractMovieYear(m)})`).join(', '));
                  } else if (originalCount > 50) {
                    console.log(`📋 Sample movies before search filter (first 20):`, uniqueMovies.slice(0, 20).map(m => `"${m.title}" (${extractMovieYear(m)})`).join(', '));
                  }
                  
                  // Check for specific movies that might be searched for
                  const searchLower = searchTerm.toLowerCase();
                  if (searchLower.includes('left foot') || searchLower.includes('my left')) {
                    const leftFootMovies = uniqueMovies.filter(m => 
                      m.title && (m.title.toLowerCase().includes('left foot') || m.title.toLowerCase().includes('my left'))
                    );
                    console.log(`🎬 Found ${leftFootMovies.length} movies with "left foot" before search filter:`, 
                      leftFootMovies.map(m => `"${m.title}" (${extractMovieYear(m)})`).join(', '));
                  }
                  
                  uniqueMovies = uniqueMovies.filter((movie: any) => {
                    const matches = matchesTitleSearch(movie.title || '', searchTerm);
                    
                    // Log matches for specific searches
                    if (searchLower.includes('left foot') || searchLower.includes('my left')) {
                      if (movie.title && (movie.title.toLowerCase().includes('left') || movie.title.toLowerCase().includes('foot'))) {
                        console.log(`🔍 Checking "${movie.title}": matches=${matches}, searchTerm="${searchTerm}"`);
                      }
                    }
                    
                    return matches;
                  });
                  
                  const filteredCount = originalCount - uniqueMovies.length;
                  console.log(`🔍 Filtered by movieSearchQuery "${searchTerm}": ${originalCount} → ${uniqueMovies.length} movies (removed ${filteredCount})`);
                  
                  // Log results for specific searches
                  if (searchLower.includes('left foot') || searchLower.includes('my left')) {
                    console.log(`🎬 Movies with "left foot" after search filter:`, 
                      uniqueMovies.filter(m => m.title && (m.title.toLowerCase().includes('left') || m.title.toLowerCase().includes('foot')))
                        .map(m => `"${m.title}" (${extractMovieYear(m)})`).join(', ') || 'NONE FOUND');
                  }
                  
                  // Log all results if search returned few results
                  if (uniqueMovies.length > 0 && uniqueMovies.length <= 10) {
                    console.log(`✅ Search results:`, uniqueMovies.map(m => `"${m.title}" (${extractMovieYear(m)})`).join(', '));
                  }
                }
                
                // Enhanced debugging for specific person queries
                if (selectedPerson.name.toLowerCase().includes('jane fonda')) {
                  console.log(`🔍 JANE FONDA DEBUG - Sample movies after filtering:`);
                  uniqueMovies.slice(0, 10).forEach((movie: any) => {
                    console.log(`  - "${movie.title}" (${extractMovieYear(movie)}) - ${movie.character || 'N/A'}`);
                  });
                }
                
                // Return complete filmography data
                data = {
                  results: uniqueMovies,
                  total_pages: Math.ceil(uniqueMovies.length / 20),
                  total_results: uniqueMovies.length,
                  page: 1,
                  person_info: {
                    id: selectedPerson.id,
                    name: selectedPerson.name,
                    popularity: selectedPerson.popularity
                  }
                };
                
                // Skip normal TMDB API call since we have the data
                return new Response(JSON.stringify(await processMovieResults(data, tmdbApiKey)), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
                
              } catch (creditsError) {
                console.error('Error fetching person credits, falling back to discover:', creditsError);
                // Fallback to discover endpoint
              }
            }
            
            // Fallback to discover endpoint (for single page requests or if credits failed)
            baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_people=${selectedPerson.id}&sort_by=popularity.desc`;
            url = `${baseUrl}&page=${page}`;
            
          } else {
            console.log('No person found for query:', searchQuery);
            return new Response(JSON.stringify({
              results: [],
              total_pages: 0,
              total_results: 0,
              page: 1,
              reason: 'No person found'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (personError) {
          console.error('Error searching for person:', personError);
          const errorMessage = personError instanceof Error ? personError.message : String(personError);
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1,
            error: `Person search failed: ${errorMessage}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        break;
      case 'all':
        // Search across all movies using multiple endpoints
        baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&sort_by=popularity.desc`;
        url = `${baseUrl}&page=${page}`;
        break;
      default:
        baseUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`;
        url = `${baseUrl}&page=${page}`;
    }

    console.log('Making request to:', url);
    
    // For year category with search, never fetch all pages
    const shouldFetchAll = category === 'year' && movieSearchQuery ? false : fetchAll;
    
    if (shouldFetchAll) {
      // Fetch ALL pages for comprehensive results
      const allResults: any[] = [];
      const seenMovieIds = new Set(); // Track movie IDs to prevent duplicates
      let currentPage = 1;
      let totalPages = 1;
      
      // For "all" category, fetch from multiple sources
      if (category === 'all') {
        const sources = [
          `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`,
          `https://api.themoviedb.org/3/movie/top_rated?api_key=${tmdbApiKey}`,
          `https://api.themoviedb.org/3/movie/now_playing?api_key=${tmdbApiKey}`,
          `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&sort_by=popularity.desc`,
          `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&sort_by=vote_average.desc&vote_count.gte=1000`,
        ];
        
        for (const sourceUrl of sources) {
          let sourcePage = 1;
          let sourceMaxPages = 1;
          
          // Get first page to determine total pages for this source
          const initialResponse = await fetch(`${sourceUrl}&page=1`);
          const initialData = await initialResponse.json();
          sourceMaxPages = Math.min(initialData.total_pages || 1, 50); // Cap at 50 pages per source
          
          while (sourcePage <= sourceMaxPages && allResults.length < 2000) { // Cap at 2000 total results
            const pageUrl = `${sourceUrl}&page=${sourcePage}`;
            console.log(`Fetching from source page ${sourcePage}/${sourceMaxPages}:`, pageUrl);
            
            try {
              const response = await fetch(pageUrl);
              const pageData = await response.json();
              
              if (pageData.results && pageData.results.length > 0) {
                // Filter out duplicates based on movie ID
                const newMovies = pageData.results.filter((movie: any) => {
                  if (seenMovieIds.has(movie.id)) {
                    return false;
                  }
                  seenMovieIds.add(movie.id);
                  return true;
                });
                allResults.push(...newMovies);
              }
              
              if (pageData.results?.length === 0) {
                break;
              }
            } catch (error) {
              console.error(`Error fetching from source page ${sourcePage}:`, error);
            }
            
            sourcePage++;
          }
        }
      } else {
        // For specific categories (like year), fetch ALL available pages
        console.log('Fetching all pages for category:', category);
        
        // First, get the first page to determine total pages
        try {
          const initialResponse = await fetch(`${baseUrl}&page=1`);
          if (!initialResponse.ok) {
            throw new Error(`Initial fetch failed: ${initialResponse.status} ${initialResponse.statusText}`);
          }
          const initialData = await initialResponse.json();
          totalPages = initialData.total_pages || 1;
          
          console.log(`Total pages available: ${totalPages}`);
          
          // Fetch all pages (with reasonable limit to prevent timeout)
          // For year queries, increase limit to get more comprehensive results
          const maxPagesToFetch = category === 'year' 
            ? Math.min(totalPages, 100) // Allow up to 100 pages for year queries (2,000 movies)
            : Math.min(totalPages, 100); // Keep 100 pages for other categories
          
          while (currentPage <= maxPagesToFetch) {
            const pageUrl = `${baseUrl}&page=${currentPage}`;
            console.log(`Fetching page ${currentPage}/${maxPagesToFetch}:`, pageUrl);
            
            try {
              const response = await fetch(pageUrl);
              if (!response.ok) {
                console.error(`Page ${currentPage} fetch failed: ${response.status} ${response.statusText}`);
                break;
              }
              const pageData = await response.json();
              
              if (pageData.results && pageData.results.length > 0) {
                // For year category, apply strict filtering on each page
                let pagesToAdd = pageData.results;
                if (category === 'year') {
                  const requestedYear = parseInt(searchQuery);
                  pagesToAdd = pageData.results.filter((movie: any) => movieMatchesYear(movie, requestedYear));
                  console.log(`Page ${currentPage}: ${pageData.results.length} total movies, ${pagesToAdd.length} matching year ${requestedYear}`);
                  
                  // Enhanced logging for year debugging
                  if (pagesToAdd.length < pageData.results.length / 2) {
                    console.log(`Low match rate for year ${requestedYear}. Sample year extraction:`, 
                      pageData.results.slice(0, 3).map((m: any) => ({
                        title: m.title,
                        release_date: m.release_date,
                        extracted_year: extractMovieYear(m)
                      }))
                    );
                  }
                }
                
                // Filter out duplicates based on movie ID
                const newMovies = pagesToAdd.filter((movie: any) => {
                  if (seenMovieIds.has(movie.id)) {
                    return false;
                  }
                  seenMovieIds.add(movie.id);
                  return true;
                });
                allResults.push(...newMovies);
                console.log(`Page ${currentPage}: Added ${newMovies.length} new movies (${pagesToAdd.length - newMovies.length} duplicates filtered). Total unique: ${allResults.length}`);
              } else {
                console.log(`Page ${currentPage}: No results, stopping fetch`);
                break;
              }
              
              // Stop if we've reached the actual last page
              if (currentPage >= (pageData.total_pages || 1)) {
                console.log(`Reached last page: ${currentPage}`);
                break;
              }
            } catch (error) {
              console.error(`Error fetching page ${currentPage}:`, error);
              // Continue to next page on error
            }
            
            currentPage++;
          }
        } catch (initialError) {
          console.error('Error in initial fetch:', initialError);
          const errorMessage = initialError instanceof Error ? initialError.message : String(initialError);
          return new Response(JSON.stringify({
            results: [],
            total_pages: 0,
            total_results: 0,
            page: 1,
            error: `Failed to fetch movies: ${errorMessage}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
      }
      
      console.log(`Fetching complete. Total unique movies found: ${allResults.length}`);
      
      data = {
        results: allResults,
        total_pages: Math.ceil(allResults.length / 20),
        total_results: allResults.length,
        page: 1
      };
    } else {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
        }
        data = await response.json();
      } catch (fetchError) {
        console.error('Error fetching from TMDB:', fetchError);
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        return new Response(JSON.stringify({
          results: [],
          total_pages: 0,
          total_results: 0,
          page: 1,
          error: `TMDB fetch failed: ${errorMessage}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }

    console.log('TMDB API response received with', (data.results || []).length, 'movies');
    
    // Log all movie titles from TMDB before any filtering
    if (category === 'year' && movieSearchQuery && !fetchAll) {
      console.log('🔍 RAW TMDB RESULTS (before any filtering):');
      console.log('  Total movies:', (data.results || []).length);
      console.log('  First 20 titles:', (data.results || []).slice(0, 20).map((m: any) => m.title));
      
      // Check specifically for "Reds"
      const redsInRawResults = (data.results || []).find((m: any) => 
        m.title && (m.title.toLowerCase().includes('reds') || m.title.toLowerCase() === 'reds')
      );
      if (redsInRawResults) {
        console.log('✅ FOUND REDS in raw TMDB results:', {
          title: redsInRawResults.title,
          id: redsInRawResults.id,
          release_date: redsInRawResults.release_date,
          year: extractMovieYear(redsInRawResults)
        });
      } else {
        console.log('❌ REDS NOT FOUND in raw TMDB results');
        console.log('  Searching for similar titles...');
        const similarTitles = (data.results || []).filter((m: any) => 
          m.title && m.title.toLowerCase().includes('red')
        );
        if (similarTitles.length > 0) {
          console.log('  Found similar titles with "red":', similarTitles.map((m: any) => ({
            title: m.title,
            year: extractMovieYear(m)
          })));
        }
      }
    }
    
    // Apply robust year filtering for year category
    if (category === 'year') {
      const requestedYear = parseInt(searchQuery);
      const originalCount = (data.results || []).length;
      
      // If this was a search query (movieSearchQuery exists AND not fetchAll), be more lenient with year matching
      // TMDB search with year filter might return movies from adjacent years
      // When fetchAll=true, we want exact year matches for caching
      const isSearchResult = !!movieSearchQuery && !fetchAll;
      const yearTolerance = isSearchResult ? 1 : 0; // Allow ±1 year for search results
      
      // Enhanced year analysis for debugging
      const allYears = (data.results || []).map((movie: any) => ({
        title: movie.title,
        releaseDate: movie.release_date,
        primaryReleaseDate: movie.primary_release_date,
        extractedYear: extractMovieYear(movie)
      }));
      console.log(`Pre-filtering year analysis for ${requestedYear}:`, allYears.slice(0, 5));
      
      // Count how many movies have valid years vs invalid
      const validYearCount = allYears.filter(m => m.extractedYear > 0).length;
      const invalidYearCount = allYears.length - validYearCount;
      console.log(`Year extraction stats: ${validYearCount} valid, ${invalidYearCount} invalid years out of ${allYears.length} total movies`);
      
      // Apply enhanced year filtering with tolerance for search results
      data.results = (data.results || []).filter((movie: any) => {
        const movieYear = extractMovieYear(movie);
        let passes: boolean;
        if (isSearchResult) {
          // For search results, allow year within tolerance
          passes = movieYear >= (requestedYear - yearTolerance) && movieYear <= (requestedYear + yearTolerance);
        } else {
          // For non-search, exact match
          passes = movieYear === requestedYear;
        }
        
        // Special logging for "Reds" to see if it's being filtered
        if (movie.title && (movie.title.toLowerCase().includes('reds') || movie.title.toLowerCase() === 'reds')) {
          console.log('🔍 REDS year filter check:', {
            title: movie.title,
            extractedYear: movieYear,
            requestedYear,
            yearTolerance,
            isSearchResult,
            passes,
            release_date: movie.release_date,
            primary_release_date: movie.primary_release_date
          });
        }
        
        return passes;
      });
      
      const filteredCount = data.results.length;
      console.log(`Year filtering complete: ${originalCount} → ${filteredCount} movies (removed ${originalCount - filteredCount} movies that didn't match year ${requestedYear}${isSearchResult ? ' (±1 tolerance)' : ''})`);
      
      // Debug logging to see what movies are returned
      console.log('Movies after year filtering:', data.results.slice(0, 10).map((m: any) => ({
        title: m.title,
        year: extractMovieYear(m),
        release_date: m.release_date
      })));
      
      // Check if "Reds" is still in results after year filtering
      if (isSearchResult) {
        const redsAfterYearFilter = data.results.find((m: any) => 
          m.title && (m.title.toLowerCase().includes('reds') || m.title.toLowerCase() === 'reds')
        );
        if (redsAfterYearFilter) {
          console.log('✅ REDS still present after year filtering:', {
            title: redsAfterYearFilter.title,
            year: extractMovieYear(redsAfterYearFilter)
          });
        } else {
          console.log('❌ REDS removed by year filtering');
        }
      }
      
      // Update pagination info after filtering
      data.total_results = filteredCount;
      data.total_pages = Math.ceil(filteredCount / 20);
    }

    return new Response(JSON.stringify(await processMovieResults(data, tmdbApiKey, { 
      preferFreshOscarStatus
    })), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching movies from TMDB:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      results: [],
      total_pages: 0,
      total_results: 0,
      page: 1
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Process movie results function to handle common transformations
async function processMovieResults(data: any, tmdbApiKey: string, opts: { preferFreshOscarStatus?: boolean } = {}) {
  console.log(`📊 Processing ${(data.results || []).length} movies...`);
  const academyAwardsMap = await getAcademyAwardsMap();
  console.log(`Academy Awards map size: ${academyAwardsMap.size} (source: ${academyAwardsMap.size > 0 ? 'JSON URL' : 'empty/cache+OMDb only'})`);

  // Apply TV content filtering to all results
  const originalCount = (data.results || []).length;
  
  // Check for "Reds" before TV filter
  const redsBeforeTVFilter = (data.results || []).find((m: any) => 
    m.title && (m.title.toLowerCase().includes('reds') || m.title.toLowerCase() === 'reds')
  );
  
  data.results = (data.results || []).filter((movie: any) => {
    const isValid = isValidMovieContent(movie);
    if (movie.title && (movie.title.toLowerCase().includes('reds') || movie.title.toLowerCase() === 'reds') && !isValid) {
      console.log('❌ REDS filtered out by TV content filter:', {
        title: movie.title,
        media_type: movie.media_type,
        genre_ids: movie.genre_ids
      });
    }
    return isValid;
  });
  
  const filteredCount = originalCount - data.results.length;
  
  if (filteredCount > 0) {
    console.log(`🚫 TV Content Filter: Removed ${filteredCount} TV shows/episodes from ${originalCount} total results`);
  }
  
  // Check if "Reds" is still present after TV filter
  if (redsBeforeTVFilter) {
    const redsAfterTVFilter = data.results.find((m: any) => 
      m.title && (m.title.toLowerCase().includes('reds') || m.title.toLowerCase() === 'reds')
    );
    if (redsAfterTVFilter) {
      console.log('✅ REDS still present after TV content filter');
    } else {
      console.log('❌ REDS removed by TV content filter');
    }
  }
  
  // Enhanced movie data transformation with proper Oscar and blockbuster detection
  // Process in batches to avoid timeouts (only for large result sets)
  const BATCH_SIZE = 50;
  const transformedMovies: any[] = [];
  const shouldBatch = data.results.length > 100; // Only batch if we have many movies
  
  const processMovie = async (movie: any) => {
      let detailedMovie = movie;
      let hasOscar = false;
      let oscarStatusNormalized = 'unknown';
      let isBlockbuster = false;
      
      // Academy Awards JSON is the authoritative source: check FIRST, even if cache has 'none'
      if (academyAwardsMap.has(movie.id)) {
        oscarStatusNormalized = academyAwardsMap.get(movie.id)!;
        hasOscar = oscarStatusNormalized === 'winner' || oscarStatusNormalized === 'nominee';
      }
      
      // Only check oscar_cache if not in Academy Awards map
      if (oscarStatusNormalized === 'unknown') {
        try {
          const { data: oscarCached } = await supabase
            .from('oscar_cache')
            .select('oscar_status')
            .eq('tmdb_id', movie.id)
            .maybeSingle();
          
          if (oscarCached) {
            oscarStatusNormalized = oscarCached.oscar_status || 'unknown';
            hasOscar = oscarStatusNormalized === 'winner' || oscarStatusNormalized === 'nominee';
          }
        } catch (err) {
          // Cache check failed, continue with API calls
        }
      }
      
      try {
        // Get detailed movie information including budget and revenue
        const detailResponse = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${tmdbApiKey}`);
        if (detailResponse.ok) {
          detailedMovie = await detailResponse.json();
          
          // Blockbuster: $50M threshold for either budget or revenue (aligned with filter in analyze-category-availability)
          const budget = detailedMovie.budget || 0;
          const revenue = detailedMovie.revenue || 0;
          isBlockbuster = budget >= 50000000 || revenue >= 50000000;
        }

        // Only fetch Oscar status from API if not already in cache or academy-awards.json
        if (oscarStatusNormalized === 'unknown') {
          const correctYear = extractMovieYear(detailedMovie);
          const oscarStatus = await resolveOscarStatus(movie.id, movie.title, correctYear, tmdbApiKey, { 
            preferFreshOscarStatus: !!opts.preferFreshOscarStatus 
          });
          oscarStatusNormalized = oscarStatus || 'unknown';
          hasOscar = oscarStatusNormalized !== 'none' && oscarStatusNormalized !== 'unknown';
        }
        
      } catch (error) {
        console.log(`Could not fetch detailed info for movie ${movie.id}:`, error);
      }

      // Use enhanced year extraction for consistency
      const correctYear = extractMovieYear(detailedMovie);
      
    return {
      id: movie.id,
      title: movie.title,
      year: correctYear,
      genre: movie.genre_ids && movie.genre_ids.length > 0 
        ? movie.genre_ids.map((id: number) => getGenreName(id)).join(' ')
        : 'Unknown',
      director: 'Unknown',
      runtime: detailedMovie.runtime || 120,
      poster: getMovieEmoji(movie.genre_ids?.[0]),
      description: movie.overview || 'No description available',
      isDrafted: false,
      tmdbId: movie.id,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      voteAverage: movie.vote_average,
      releaseDate: movie.release_date,
      budget: detailedMovie.budget || 0,
      revenue: detailedMovie.revenue || 0,
      hasOscar,
      oscar_status: oscarStatusNormalized,
      isBlockbuster
    };
  };
  
  if (shouldBatch) {
    // Process in batches for large result sets
    for (let i = 0; i < data.results.length; i += BATCH_SIZE) {
      const batch = data.results.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(processMovie));
      transformedMovies.push(...batchResults);
    }
  } else {
    // Process all at once for smaller result sets
    const results = await Promise.all(data.results.map(processMovie));
    transformedMovies.push(...results);
  }

  console.log(`✅ Processed ${transformedMovies.length} movies successfully`);

  // Coverage logging for oscar status and blockbuster
  try {
    const oscarCounts = transformedMovies.reduce((acc: any, m: any) => {
      const key = m.oscar_status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('🏆 Oscar status distribution:', oscarCounts);
    
    const blockbusterCount = transformedMovies.filter((m: any) => m.isBlockbuster === true).length;
    const hasRevenueCount = transformedMovies.filter((m: any) => m.revenue && m.revenue > 0).length;
    const byBudget = transformedMovies.filter((m: any) => m.budget && m.budget >= 50000000).length;
    console.log(`💰 Blockbuster: ${blockbusterCount} (budget>=50M: ${byBudget}, revenue data: ${hasRevenueCount})`);
    
    // Log sample of movies with Oscar status for debugging
    const oscarMovies = transformedMovies.filter((m: any) => m.oscar_status === 'winner' || m.oscar_status === 'nominee');
    if (oscarMovies.length > 0) {
      console.log(`🏆 Found ${oscarMovies.length} Oscar movies. Sample:`, oscarMovies.slice(0, 5).map((m: any) => ({ title: m.title, oscar_status: m.oscar_status })));
    } else {
      console.log('⚠️ No Oscar movies found - this might indicate a problem with Oscar status fetching');
    }
  } catch {}

  // Decade distribution logging for person-based fetches
  try {
    const decadeDist = transformedMovies.reduce((acc: any, m: any) => {
      const y = m.year || 0;
      if (y > 1900) {
        const d = Math.floor(y / 10) * 10;
        acc[d] = (acc[d] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    console.log('📅 Decade distribution:', decadeDist);
  } catch {}

  return {
    results: transformedMovies,
    total_pages: data.total_pages,
    total_results: data.total_results,
    page: data.page
  };
}

// Helper function to map genre IDs to names
function getGenreName(genreId: number): string {
  const genres: { [key: number]: string } = {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Sci-Fi',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western'
  };
  return genres[genreId] || 'Unknown';
}

// Helper function to get movie emoji based on genre
function getMovieEmoji(genreId: number): string {
  const emojiMap: { [key: number]: string } = {
    28: '💥', // Action
    12: '🗺️', // Adventure
    16: '🎨', // Animation
    35: '😂', // Comedy
    80: '🔫', // Crime
    99: '📽️', // Documentary
    18: '🎭', // Drama
    10751: '👨‍👩‍👧‍👦', // Family
    14: '🧙‍♂️', // Fantasy
    36: '🏛️', // History
    27: '👻', // Horror
    10402: '🎵', // Music
    9648: '🔍', // Mystery
    10749: '💕', // Romance
    878: '🚀', // Sci-Fi
    53: '😰', // Thriller
    10752: '⚔️', // War
    37: '🤠'  // Western
  };
  return emojiMap[genreId] || '🎬';
}
