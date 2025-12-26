import { CategoryConfig } from '@/types/categoryTypes';

export const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  'Action/Adventure': {
    id: 'action-adventure',
    name: 'Action/Adventure',
    description: 'Movies with action or adventure elements',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.5, 10),
    validationRules: [
      { type: 'minMovies', config: { minimum: 10 } },
      { type: 'themeCompatible', config: { themes: ['year', 'people'] } }
    ],
    themes: ['year', 'people'],
    popularity: 'high',
    icon: '🎬'
  },
  'Animated': {
    id: 'animated',
    name: 'Animated',
    description: 'Animated movies and films',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.5, 8),
    validationRules: [
      { type: 'minMovies', config: { minimum: 8 } },
      { type: 'themeCompatible', config: { themes: ['year', 'people'] } }
    ],
    themes: ['year', 'people'],
    popularity: 'medium',
    icon: '🎨'
  },
  'Comedy': {
    id: 'comedy',
    name: 'Comedy',
    description: 'Comedy movies and humorous films',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.5, 12),
    validationRules: [
      { type: 'minMovies', config: { minimum: 12 } },
      { type: 'themeCompatible', config: { themes: ['year', 'people'] } }
    ],
    themes: ['year', 'people'],
    popularity: 'high',
    icon: '😂'
  },
  'Drama/Romance': {
    id: 'drama-romance',
    name: 'Drama/Romance',
    description: 'Drama and romantic movies',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.5, 15),
    validationRules: [
      { type: 'minMovies', config: { minimum: 15 } },
      { type: 'themeCompatible', config: { themes: ['year', 'people'] } }
    ],
    themes: ['year', 'people'],
    popularity: 'high',
    icon: '💕'
  },
  'Sci-Fi/Fantasy': {
    id: 'scifi-fantasy',
    name: 'Sci-Fi/Fantasy',
    description: 'Science fiction and fantasy movies',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.5, 10),
    validationRules: [
      { type: 'minMovies', config: { minimum: 10 } },
      { type: 'themeCompatible', config: { themes: ['year', 'people'] } }
    ],
    themes: ['year', 'people'],
    popularity: 'high',
    icon: '🚀'
  },
  'Horror/Thriller': {
    id: 'horror-thriller',
    name: 'Horror/Thriller',
    description: 'Horror and thriller movies',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.5, 8),
    validationRules: [
      { type: 'minMovies', config: { minimum: 8 } },
      { type: 'themeCompatible', config: { themes: ['year', 'people'] } }
    ],
    themes: ['year', 'people'],
    popularity: 'medium',
    icon: '👻'
  },
  "30's": {
    id: '30s',
    name: "30's",
    description: 'Movies from the 1930s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.0, 4),
    validationRules: [
      { type: 'minMovies', config: { minimum: 4 } },
      { type: 'yearRange', config: { start: 1930, end: 1939 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'low',
    icon: '🎞️'
  },
  "40's": {
    id: '40s',
    name: "40's",
    description: 'Movies from the 1940s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.0, 5),
    validationRules: [
      { type: 'minMovies', config: { minimum: 5 } },
      { type: 'yearRange', config: { start: 1940, end: 1949 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'low',
    icon: '🎬'
  },
  "50's": {
    id: '50s',
    name: "50's",
    description: 'Movies from the 1950s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.1, 5),
    validationRules: [
      { type: 'minMovies', config: { minimum: 5 } },
      { type: 'yearRange', config: { start: 1950, end: 1959 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'low',
    icon: '🎭'
  },
  "60's": {
    id: '60s',
    name: "60's",
    description: 'Movies from the 1960s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.1, 6),
    validationRules: [
      { type: 'minMovies', config: { minimum: 6 } },
      { type: 'yearRange', config: { start: 1960, end: 1969 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'low',
    icon: '🕺'
  },
  "70's": {
    id: '70s',
    name: "70's",
    description: 'Movies from the 1970s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.2, 6),
    validationRules: [
      { type: 'minMovies', config: { minimum: 6 } },
      { type: 'yearRange', config: { start: 1970, end: 1979 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'low',
    icon: '📼'
  },
  "80's": {
    id: '80s',
    name: "80's",
    description: 'Movies from the 1980s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.3, 8),
    validationRules: [
      { type: 'minMovies', config: { minimum: 8 } },
      { type: 'yearRange', config: { start: 1980, end: 1989 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'medium',
    icon: '📀'
  },
  "90's": {
    id: '90s',
    name: "90's",
    description: 'Movies from the 1990s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.4, 10),
    validationRules: [
      { type: 'minMovies', config: { minimum: 10 } },
      { type: 'yearRange', config: { start: 1990, end: 1999 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'high',
    icon: '💿'
  },
  "2000's": {
    id: '2000s',
    name: "2000's",
    description: 'Movies from the 2000s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.5, 12),
    validationRules: [
      { type: 'minMovies', config: { minimum: 12 } },
      { type: 'yearRange', config: { start: 2000, end: 2009 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'high',
    icon: '📱'
  },
  "2010's": {
    id: '2010s',
    name: "2010's",
    description: 'Movies from the 2010s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.5, 15),
    validationRules: [
      { type: 'minMovies', config: { minimum: 15 } },
      { type: 'yearRange', config: { start: 2010, end: 2019 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'high',
    icon: '📺'
  },
  "2020's": {
    id: '2020s',
    name: "2020's",
    description: 'Movies from the 2020s',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.2, 6),
    validationRules: [
      { type: 'minMovies', config: { minimum: 6 } },
      { type: 'yearRange', config: { start: 2020, end: 2029 } },
      { type: 'themeCompatible', config: { themes: ['people'] } }
    ],
    themes: ['people'],
    popularity: 'medium',
    icon: '🎭'
  },
  'Academy Award Nominee or Winner': {
    id: 'academy-award',
    name: 'Academy Award Nominee or Winner',
    description: 'Any film that received at least one Academy Award (Oscar) nomination or win, in any category',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.2, 8),
    validationRules: [
      { type: 'minMovies', config: { minimum: 8 } },
      { type: 'themeCompatible', config: { themes: ['year', 'people'] } }
    ],
    themes: ['year', 'people'],
    popularity: 'medium',
    icon: '🏆',
    alwaysAvailable: true // Always allow this category - no validation needed
  },
  'Blockbuster (minimum of $50 Mil)': {
    id: 'blockbuster',
    name: 'Blockbuster (minimum of $50 Mil)',
    description: 'High-revenue blockbuster movies',
    minMoviesRequired: (playerCount) => Math.max(playerCount * 1.3, 10),
    validationRules: [
      { type: 'minMovies', config: { minimum: 10 } },
      { type: 'themeCompatible', config: { themes: ['year', 'people'] } }
    ],
    themes: ['year', 'people'],
    popularity: 'high',
    icon: '💰',
    alwaysAvailable: true // Always allow this category - no validation needed
  }
};

export const getCategoryConfig = (categoryName: string): CategoryConfig | undefined => {
  return CATEGORY_CONFIGS[categoryName];
};

export const getCategoriesForTheme = (theme: string): CategoryConfig[] => {
  return Object.values(CATEGORY_CONFIGS).filter(config => 
    config.themes.includes(theme)
  );
};

/**
 * Get spec categories for an actor as CategoryConfig objects
 * This allows spec categories to be included in category selection UI
 */
export const getSpecCategoriesForActor = async (actorName: string): Promise<CategoryConfig[]> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Try exact match first
    let { data, error } = await supabase
      .from('actor_spec_categories')
      .select('category_name, movie_tmdb_ids, description')
      .eq('actor_name', actorName);

    if (error || !data || data.length === 0) {
      // Try case-insensitive match
      ({ data, error } = await supabase
        .from('actor_spec_categories')
        .select('category_name, movie_tmdb_ids, description')
        .ilike('actor_name', actorName));
    }

    if (error || !data || data.length === 0) {
      return [];
    }

    // Convert spec categories to CategoryConfig format
    return data.map((row: any) => ({
      id: `spec-${row.category_name.toLowerCase().replace(/\s+/g, '-')}`,
      name: row.category_name,
      description: row.description || `Movies from ${row.category_name} for this actor`,
      minMoviesRequired: (playerCount: number) => Math.max(playerCount * 1.0, 1),
      validationRules: [
        { type: 'minMovies', config: { minimum: 1 } },
        { type: 'themeCompatible', config: { themes: ['people'] } }
      ],
      themes: ['people'],
      popularity: 'medium' as const,
      icon: '⭐'
    }));
  } catch (err) {
    console.error('Error fetching spec categories:', err);
    return [];
  }
};