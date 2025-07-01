
import { fetchAllPages } from '../utils/api.ts';
import { transformMovies } from '../utils/transformers.ts';

export async function handlePopularMovies(tmdbApiKey: string, page: number, fetchAll: boolean) {
  const baseUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbApiKey}`;
  
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

export async function handleSearchMovies(tmdbApiKey: string, searchQuery: string, page: number, fetchAll: boolean) {
  const baseUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(searchQuery)}`;
  
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

export async function handleYearMovies(tmdbApiKey: string, year: string, page: number, fetchAll: boolean) {
  const baseUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&primary_release_year=${year}`;
  
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
