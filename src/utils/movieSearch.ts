/**
 * Flexible title matching helper - handles variations and partial matches
 * This matches the backend logic in fetch-movies/index.ts
 */
export function matchesTitleSearch(movieTitle: string, searchQuery: string): boolean {
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
