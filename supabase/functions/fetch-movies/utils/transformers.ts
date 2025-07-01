
import { getGenreName, getMovieEmoji, getPersonEmoji } from './emojis.ts';

// Transform TMDB movie data to match our Movie interface
export function transformMovies(movies: any[]) {
  return movies?.map((movie: any) => ({
    id: movie.id,
    title: movie.title,
    year: new Date(movie.release_date).getFullYear() || 0,
    genre: movie.genre_ids?.[0] ? getGenreName(movie.genre_ids[0]) : 'Unknown',
    director: 'Unknown',
    runtime: movie.runtime || 120,
    poster: getMovieEmoji(movie.genre_ids?.[0]),
    description: movie.overview || 'No description available',
    isDrafted: false,
    tmdbId: movie.id,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    voteAverage: movie.vote_average,
    releaseDate: movie.release_date
  })) || [];
}

// Transform TMDB person data to match our Movie interface (for person search)
export function transformPeople(people: any[]) {
  return people?.map((person: any) => ({
    id: person.id,
    title: person.name,
    year: 0,
    genre: person.known_for_department || 'Unknown',
    director: 'N/A',
    runtime: 0,
    poster: getPersonEmoji(person.known_for_department),
    description: `Known for: ${person.known_for?.map((item: any) => item.title || item.name).join(', ') || 'Various works'}`,
    isDrafted: false,
    tmdbId: person.id,
    posterPath: person.profile_path,
    backdropPath: null,
    voteAverage: person.popularity,
    releaseDate: null,
    knownForDepartment: person.known_for_department
  })) || [];
}
