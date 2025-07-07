
// API utility functions for TMDB operations

export interface FetchResult {
  results: any[];
  total_pages: number;
  total_results: number;
  page: number;
}

// Helper function to fetch pages with smart batching
export const fetchWithBatching = async (baseUrl: string, maxMovies = 100): Promise<FetchResult> => {
  let allResults: any[] = [];
  let currentPage = 1;
  let totalPages = 1;

  // First, get a reasonable number of pages (limit to prevent timeout)
  const maxPages = Math.min(5, totalPages); // Limit to 5 pages max initially

  do {
    const url = `${baseUrl}&page=${currentPage}`;
    console.log(`Fetching page ${currentPage} of ${Math.min(maxPages, totalPages)}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results) {
      allResults = [...allResults, ...data.results];
    }
    
    totalPages = data.total_pages || 1;
    currentPage++;
    
    // Break if we've reached our limit or max movies
    if (currentPage > maxPages || allResults.length >= maxMovies) break;
    
  } while (currentPage <= totalPages);

  return {
    results: allResults.slice(0, maxMovies), // Ensure we don't exceed max
    total_pages: totalPages,
    total_results: allResults.length,
    page: 1
  };
};

// Build API URL based on category and parameters
export const buildApiUrl = async (
  category: string, 
  searchQuery: string, 
  page: number, 
  tmdbApiKey: string
): Promise<{ url: string; baseUrl: string }> => {
  let url = '';
  let baseUrl = '';
  
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
      baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_year=${searchQuery}`;
      url = `${baseUrl}&page=${page}`;
      break;
    case 'person':
      // First, search for the person to get their ID
      const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
      const personResponse = await fetch(personSearchUrl);
      const personData = await personResponse.json();
      
      if (personData.results && personData.results.length > 0) {
        // Find exact match or use the first result
        const exactMatch = personData.results.find((person: any) => 
          person.name.toLowerCase() === searchQuery.toLowerCase()
        );
        const selectedPerson = exactMatch || personData.results[0];
        
        // Search for movies featuring this person
        baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_people=${selectedPerson.id}&sort_by=popularity.desc`;
        url = `${baseUrl}&page=${page}`;
      } else {
        // Return empty URL to indicate no person found
        return { url: '', baseUrl: '' };
      }
      break;
    case 'person_search':
      // This is for searching people (Home page)
      baseUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
      url = `${baseUrl}&page=${page}`;
      break;
    default:
      baseUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`;
      url = `${baseUrl}&page=${page}`;
  }

  return { url, baseUrl };
};
