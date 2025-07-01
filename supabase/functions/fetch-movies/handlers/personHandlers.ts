
import { fetchAllPages } from '../utils/api.ts';
import { transformMovies, transformPeople } from '../utils/transformers.ts';

export async function handlePersonMovies(tmdbApiKey: string, searchQuery: string, page: number, fetchAll: boolean) {
  // First, search for the person to get their ID
  const personSearchUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
  const personResponse = await fetch(personSearchUrl);
  const personData = await personResponse.json();
  
  if (!personData.results || personData.results.length === 0) {
    return {
      results: [],
      total_pages: 0,
      total_results: 0,
      page: 1
    };
  }
  
  // Find exact match or use the first result
  const exactMatch = personData.results.find((person: any) => 
    person.name.toLowerCase() === searchQuery.toLowerCase()
  );
  const selectedPerson = exactMatch || personData.results[0];
  
  // Search for movies featuring this person
  const baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_people=${selectedPerson.id}&sort_by=popularity.desc`;
  
  if (fetchAll) {
    const data = await fetchAllPages(baseUrl);
    return {
      results: transformMovies(data.results),
      total_pages: data.total_pages,
      total_results: data.total_results,
      page: data.page
    };
  }
  
  const url = `${baseUrl}&page=${page}`;
  const response = await fetch(url);
  const data = await response.json();
  
  return {
    results: transformMovies(data.results),
    total_pages: data.total_pages,
    total_results: data.total_results,
    page: data.page
  };
}

export async function handlePersonSearch(tmdbApiKey: string, searchQuery: string, page: number, fetchAll: boolean) {
  const baseUrl = `https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
  
  if (fetchAll) {
    const data = await fetchAllPages(baseUrl);
    return {
      results: transformPeople(data.results),
      total_pages: data.total_pages,
      total_results: data.total_results,
      page: data.page
    };
  }
  
  const url = `${baseUrl}&page=${page}`;
  const response = await fetch(url);
  const data = await response.json();
  
  return {
    results: transformPeople(data.results),
    total_pages: data.total_pages,
    total_results: data.total_results,
    page: data.page
  };
}
