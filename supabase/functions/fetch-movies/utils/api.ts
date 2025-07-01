
// Helper function to fetch all pages from TMDB API
export async function fetchAllPages(baseUrl: string) {
  let allResults: any[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const url = `${baseUrl}&page=${currentPage}`;
    console.log(`Fetching page ${currentPage} of ${totalPages}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results) {
      allResults = [...allResults, ...data.results];
    }
    
    totalPages = data.total_pages || 1;
    currentPage++;
    
    // Limit to prevent excessive API calls (max 500 pages)
    if (currentPage > 500) break;
    
  } while (currentPage <= totalPages);

  return {
    results: allResults,
    total_pages: totalPages,
    total_results: allResults.length,
    page: 1
  };
}
